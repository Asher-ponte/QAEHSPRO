
'use server';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

interface TestResult {
    name: string;
    status: 'success' | 'failed';
    details: string;
}

async function runTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
    try {
        await testFn();
        return { name, status: 'success', details: 'OK' };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        console.error(`System Health Check failed for "${name}":`, error);
        return { name, status: 'failed', details: errorMessage };
    }
}

export async function GET() {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
    }

    const db = await getDb();

    const tests = [
        runTest('Database Connection', () => db.getConnection().then(conn => conn.release())),
        runTest('Users Table', () => db.query("SELECT COUNT(*) FROM users")),
        runTest('Sites Table', () => db.query("SELECT COUNT(*) FROM sites")),
        runTest('Courses Table', () => db.query("SELECT COUNT(*) FROM courses")),
        runTest('Modules Table', () => db.query("SELECT COUNT(*) FROM modules")),
        runTest('Lessons Table', () => db.query("SELECT COUNT(*) FROM lessons")),
        runTest('Enrollments Table', () => db.query("SELECT COUNT(*) FROM enrollments")),
        runTest('User Progress Table', () => db.query("SELECT COUNT(*) FROM user_progress")),
        runTest('Quiz Attempts Table', () => db.query("SELECT COUNT(*) FROM quiz_attempts")),
        runTest('Final Assessment Attempts Table', () => db.query("SELECT COUNT(*) FROM final_assessment_attempts")),
        runTest('Certificates Table', () => db.query("SELECT COUNT(*) FROM certificates")),
        runTest('Signatories Table', () => db.query("SELECT COUNT(*) FROM signatories")),
        runTest('Transactions Table', () => db.query("SELECT COUNT(*) FROM transactions")),
        runTest('App Settings Table', () => db.query("SELECT COUNT(*) FROM app_settings")),
    ];

    const results = await Promise.all(tests);

    return NextResponse.json(results);
}
