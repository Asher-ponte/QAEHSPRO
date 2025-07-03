
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
        const courseId = parseInt(params.id, 10);

        if (isNaN(courseId)) {
            return NextResponse.json({ error: 'Course ID must be a number.' }, { status: 400 });
        }

        await db.run('BEGIN TRANSACTION');

        // 1. Get all lesson IDs and total lesson count for the course
        const lessons = await db.all(`
            SELECT l.id FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id = ?
        `, courseId);
        
        const lessonIds = lessons.map(l => l.id);
        const totalLessons = lessonIds.length;

        if (totalLessons === 0) {
            await db.run('COMMIT');
            return NextResponse.json({ success: true, message: 'Course has no lessons, so no progress to reset.' });
        }
        
        // 2. Get all users enrolled in the course
        const enrolledUsers = await db.all(`SELECT user_id FROM enrollments WHERE course_id = ?`, courseId);
        if (enrolledUsers.length === 0) {
            await db.run('COMMIT');
            return NextResponse.json({ success: true, message: 'No users are enrolled in this course.' });
        }
        const enrolledUserIds = enrolledUsers.map(u => u.user_id);

        // 3. Find which of the enrolled users have 100% progress
        const userProgressCounts = await db.all(`
            SELECT user_id, COUNT(lesson_id) as completed_count
            FROM user_progress
            WHERE user_id IN (${enrolledUserIds.map(() => '?').join(',')})
              AND lesson_id IN (${lessonIds.map(() => '?').join(',')})
              AND completed = 1
            GROUP BY user_id
        `, [...enrolledUserIds, ...lessonIds]);

        const userIdsToReset = userProgressCounts
            .filter(p => p.completed_count === totalLessons)
            .map(p => p.user_id);
        
        if (userIdsToReset.length === 0) {
            await db.run('COMMIT');
            return NextResponse.json({ success: true, message: 'No users have 100% completion to reset for re-training.' });
        }
        
        // 4. Delete progress for these completed users for this course's lessons
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
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: 'Failed to initiate re-training due to a server error', details }, { status: 500 });
    }
}
