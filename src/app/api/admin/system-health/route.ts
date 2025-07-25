
'use server';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

interface TestResult {
    name: string;
    status: 'success' | 'failed';
    details: string;
    group: 'Connectivity' | 'Schema Integrity' | 'End-to-End';
}

async function runTest(name: string, group: TestResult['group'], testFn: () => Promise<any>): Promise<TestResult> {
    try {
        const result = await testFn();
        const details = typeof result === 'string' ? result : 'OK';
        return { name, group, status: 'success', details };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        console.error(`System Health Check failed for "${name}":`, error);
        return { name, group, status: 'failed', details: errorMessage };
    }
}

async function checkSchema(db: any, tableName: string, requiredColumns: string[]): Promise<string> {
    const [columns] = await db.query<RowDataPacket[]>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?`,
        [process.env.DB_NAME, tableName]
    );

    const actualColumns = new Set(columns.map(c => c.column_name));
    const missingColumns = requiredColumns.filter(col => !actualColumns.has(col));

    if (missingColumns.length > 0) {
        throw new Error(`Missing columns: ${missingColumns.join(', ')}`);
    }
    return `OK (${actualColumns.size} columns validated)`;
}

async function runEndToEndTest(db: any): Promise<string> {
    const testSiteId = 'health-check-site';
    const testUserId = 999999;
    const testCourseId = 999999;
    const testModuleId = 999999;
    const testLessonId = 999999;

    const cleanup = async () => {
        // Cleanup in reverse order of creation to respect foreign key constraints
        await db.query('DELETE FROM user_progress WHERE user_id = ?', [testUserId]);
        await db.query('DELETE FROM lessons WHERE id = ?', [testLessonId]);
        await db.query('DELETE FROM modules WHERE id = ?', [testModuleId]);
        await db.query('DELETE FROM enrollments WHERE user_id = ?', [testUserId]);
        await db.query('DELETE FROM courses WHERE id = ?', [testCourseId]);
        await db.query('DELETE FROM users WHERE id = ?', [testUserId]);
        await db.query('DELETE FROM sites WHERE id = ?', [testSiteId]);
    };

    try {
        // Cleanup before starting to ensure a clean slate from any previous failed runs
        await cleanup(); 

        await db.query('START TRANSACTION');
        
        // 1. Create Site
        await db.query<ResultSetHeader>(`INSERT INTO sites(id, name) VALUES (?, ?)`, [testSiteId, 'Health Check Site']);

        // 2. Create User
        await db.query<ResultSetHeader>(`INSERT INTO users(id, site_id, username, password, role, type) VALUES (?, ?, ?, ?, ?, ?)`, [testUserId, testSiteId, 'healthcheckuser', 'password', 'Employee', 'Employee']);

        // 3. Create Course
        await db.query<ResultSetHeader>(`INSERT INTO courses(id, site_id, title, description, category) VALUES (?, ?, ?, ?, ?)`, [testCourseId, testSiteId, 'Health Check Course', 'Desc', 'Category']);

        // 4. Create Module & Lesson
        await db.query<ResultSetHeader>(`INSERT INTO modules(id, course_id, title, \`order\`) VALUES (?, ?, ?, ?)`, [testModuleId, testCourseId, 'HC Module', 1]);
        await db.query<ResultSetHeader>(`INSERT INTO lessons(id, module_id, title, type, \`order\`) VALUES (?, ?, ?, ?, ?)`, [testLessonId, testModuleId, 'HC Lesson', 'document', 1]);

        // 5. Enroll User
        await db.query<ResultSetHeader>(`INSERT INTO enrollments(user_id, course_id) VALUES (?, ?)`, [testUserId, testCourseId]);

        // 6. Complete Lesson
        await db.query<ResultSetHeader>(`INSERT INTO user_progress(user_id, lesson_id, completed) VALUES (?, ?, 1)`, [testUserId, testLessonId]);

        await db.query('COMMIT');
        
        return "OK (Create, Enroll, Progress)";

    } catch (error) {
        await db.query('ROLLBACK').catch(console.error);
        throw error; // Re-throw the error to be caught by runTest
    } finally {
        // Final cleanup to ensure no test data is left behind
        await cleanup();
    }
}


export async function GET() {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
    }

    const db = await getDb();

    const connectivityTests = [
        runTest('Database Connection', 'Connectivity', () => db.getConnection().then(conn => conn.release())),
        runTest('Users Table Reachable', 'Connectivity', () => db.query("SELECT 1 FROM users LIMIT 1")),
        runTest('Courses Table Reachable', 'Connectivity', () => db.query("SELECT 1 FROM courses LIMIT 1")),
        runTest('Lessons Table Reachable', 'Connectivity', () => db.query("SELECT 1 FROM lessons LIMIT 1")),
        runTest('Certificates Table Reachable', 'Connectivity', () => db.query("SELECT 1 FROM certificates LIMIT 1")),
        runTest('Transactions Table Reachable', 'Connectivity', () => db.query("SELECT 1 FROM transactions LIMIT 1")),
    ];

    const schemaTests = [
        runTest('Users Schema', 'Schema Integrity', () => checkSchema(db, 'users', ['id', 'username', 'password', 'role', 'type', 'site_id'])),
        runTest('Courses Schema', 'Schema Integrity', () => checkSchema(db, 'courses', ['id', 'site_id', 'title', 'is_public', 'is_internal', 'pre_test_content', 'final_assessment_content'])),
        runTest('Lessons Schema', 'Schema Integrity', () => checkSchema(db, 'lessons', ['id', 'module_id', 'title', 'type', 'content', 'order'])),
        runTest('Enrollments Schema', 'Schema Integrity', () => checkSchema(db, 'enrollments', ['user_id', 'course_id'])),
        runTest('User Progress Schema', 'Schema Integrity', () => checkSchema(db, 'user_progress', ['user_id', 'lesson_id', 'completed'])),
        runTest('Final Assessment Attempts Schema', 'Schema Integrity', () => checkSchema(db, 'final_assessment_attempts', ['id', 'user_id', 'course_id', 'score', 'passed'])),
        runTest('Certificates Schema', 'Schema Integrity', () => checkSchema(db, 'certificates', ['id', 'user_id', 'course_id', 'certificate_number', 'completion_date'])),
    ];
    
    const e2eTests = [
        runTest('Core CRUD Cycle', 'End-to-End', () => runEndToEndTest(db)),
    ];

    const allTests = [...connectivityTests, ...schemaTests, ...e2eTests];
    const results = await Promise.all(allTests);

    return NextResponse.json(results);
}
