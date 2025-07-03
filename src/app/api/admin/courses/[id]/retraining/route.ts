
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    let db;
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'Admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        db = await getDb();
        const { id: courseId } = params;

        if (!courseId) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        await db.run('BEGIN TRANSACTION');

        // 1. Get all lesson IDs for the course
        const lessons = await db.all(`
            SELECT l.id FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id = ?
        `, courseId);
        
        const lessonIds = lessons.map(l => l.id);

        if (lessonIds.length === 0) {
            // No lessons, nothing to reset
            await db.run('COMMIT');
            return NextResponse.json({ success: true, message: 'Course has no lessons to reset progress for.' });
        }

        // 2. Get all users who have completed the course (have a certificate)
        const completedUsers = await db.all(`
            SELECT DISTINCT user_id FROM certificates WHERE course_id = ?
        `, courseId);

        const userIdsToReset = completedUsers.map(u => u.user_id);
        
        if (userIdsToReset.length === 0) {
            // No users have completed the course yet
            await db.run('COMMIT');
            return NextResponse.json({ success: true, message: 'No completed users to reset for re-training.' });
        }
        
        // 3. Delete progress for these users and lessons
        const lessonIdsPlaceholder = lessonIds.map(() => '?').join(',');
        const userIdsPlaceholder = userIdsToReset.map(() => '?').join(',');

        await db.run(
            `DELETE FROM user_progress WHERE lesson_id IN (${lessonIdsPlaceholder}) AND user_id IN (${userIdsPlaceholder})`,
            [...lessonIds, ...userIdsToReset]
        );

        // We specifically DO NOT delete the certificates. They serve as a historical record.
        // A new certificate will be generated upon next completion.

        await db.run('COMMIT');
        
        return NextResponse.json({ success: true, message: `Progress for ${userIdsToReset.length} user(s) has been reset for re-training.` });

    } catch (error) {
        if (db) {
            await db.run('ROLLBACK').catch(console.error);
        }
        console.error("Failed to initiate re-training:", error);
        return NextResponse.json({ error: 'Failed to initiate re-training due to a server error' }, { status: 500 });
    }
}
