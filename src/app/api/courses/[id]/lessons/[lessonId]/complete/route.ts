
'use server'

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

async function hasAccess(db: any, user: any, courseId: number) {
    if (user.role === 'Admin') return true;
    const [enrollmentRows] = await db.query<RowDataPacket[]>('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [user.id, courseId]);
    if (enrollmentRows.length > 0) return true;
    if (user.type === 'External') {
        const [transactionRows] = await db.query<RowDataPacket[]>(`SELECT id FROM transactions WHERE user_id = ? AND course_id = ? AND status IN ('pending', 'completed')`, [user.id, courseId]);
        if (transactionRows.length > 0) return true;
    }
    return false;
}

export async function POST(
    request: NextRequest, 
    { params }: { params: { lessonId: string, id: string } }
) {
    const { user } = await getCurrentSession();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let db;
    try {
        db = await getDb();
        const lessonId = parseInt(params.lessonId, 10);
        const courseId = parseInt(params.id, 10);
        
        if (isNaN(lessonId) || isNaN(courseId)) {
             return NextResponse.json({ error: 'Invalid course or lesson ID' }, { status: 400 });
        }
        
        const userId = user.id;
        
        const canAccess = await hasAccess(db, user, courseId);
        if (!canAccess) {
             return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
        }
        
        await db.query('START TRANSACTION');

        await db.query(
            'INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE completed = 1',
            [userId, lessonId]
        );

        const [totalLessonsRows] = await db.query<RowDataPacket[]>(
            `SELECT COUNT(l.id) as count FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ?`,
            [courseId]
        );
        const totalLessons = totalLessonsRows[0]?.count ?? 0;

        const [completedLessonsRows] = await db.query<RowDataPacket[]>(
            `SELECT COUNT(up.lesson_id) as count FROM user_progress up JOIN lessons l ON up.lesson_id = l.id JOIN modules m ON l.module_id = m.id WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1`,
            [userId, courseId]
        );
        const completedCount = completedLessonsRows[0]?.count ?? 0;
        
        let redirectToAssessment = false;
        if (totalLessons > 0 && completedCount >= totalLessons) {
            const [courseInfoRows] = await db.query<any[]>('SELECT final_assessment_content FROM courses WHERE id = ?', [courseId]);
            const courseInfo = courseInfoRows[0];
            const hasFinalAssessment = !!courseInfo?.final_assessment_content;

            if (hasFinalAssessment) {
                redirectToAssessment = true;
            }
        }

        await db.query('COMMIT');
        
        return NextResponse.json({ success: true, redirectToAssessment });

    } catch (error) {
        if (db) await db.query('ROLLBACK').catch(console.error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to mark lesson as complete. Error: ", errorMessage, error);
        return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
    }
}
