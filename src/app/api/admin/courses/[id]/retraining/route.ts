
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (user?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const db = await getDb();

    try {
        let body: { targetSiteId?: string; courseTitle?: string } = {};
        try {
            // It's a POST, but the body might be empty if not a super admin action
            body = await request.json();
        } catch (e) {
            // Ignore error if body is empty
        }

        const { targetSiteId, courseTitle } = body;
        let effectiveSiteId = sessionSiteId;
        let effectiveCourseId = parseInt(params.id, 10);
        
        if (isSuperAdmin && targetSiteId && courseTitle) {
            effectiveSiteId = targetSiteId;
            const [courseRows] = await db.query<RowDataPacket[]>('SELECT id FROM courses WHERE title = ? AND site_id = ?', [courseTitle, effectiveSiteId]);
            const course = courseRows[0];

            if (!course) {
                 return NextResponse.json({ error: `Course "${courseTitle}" not found in the selected branch.` }, { status: 404 });
            }
            effectiveCourseId = course.id;
        }

        if (isNaN(effectiveCourseId)) {
            return NextResponse.json({ error: 'Course ID must be a number.' }, { status: 400 });
        }

        await db.query('START TRANSACTION');

        const [lessonRows] = await db.query<RowDataPacket[]>(`
            SELECT l.id FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id = ?
        `, [effectiveCourseId]);
        
        const lessonIds = lessonRows.map(l => l.id);
        const totalLessons = lessonIds.length;

        if (totalLessons === 0) {
            await db.query('COMMIT');
            return NextResponse.json({ success: true, message: 'Course has no lessons, so no progress to reset.' });
        }
        
        const [enrolledUserRows] = await db.query<RowDataPacket[]>(`SELECT user_id FROM enrollments WHERE course_id = ?`, [effectiveCourseId]);
        if (enrolledUserRows.length === 0) {
            await db.query('COMMIT');
            return NextResponse.json({ success: true, message: 'No users are enrolled in this course.' });
        }
        const enrolledUserIds = enrolledUserRows.map(u => u.user_id);
        
        if (enrolledUserIds.length === 0) {
            await db.query('COMMIT');
            return NextResponse.json({ success: true, message: 'No users to process for retraining.' });
        }

        const [userProgressRows] = await db.query<RowDataPacket[]>(`
            SELECT user_id, COUNT(lesson_id) as completed_count
            FROM user_progress
            WHERE user_id IN (?)
              AND lesson_id IN (?)
              AND completed = 1
            GROUP BY user_id
        `, [enrolledUserIds, lessonIds]);
        
        const userIdsToReset = userProgressRows
            .filter(p => p.completed_count === totalLessons)
            .map(p => p.user_id);
        
        if (userIdsToReset.length === 0) {
            await db.query('COMMIT');
            return NextResponse.json({ success: true, message: 'No users have 100% completion to reset for re-training.' });
        }
        
        // Delete final assessment attempts for these users on this course.
        await db.query(
            `DELETE FROM final_assessment_attempts WHERE course_id = ? AND user_id IN (?)`,
            [effectiveCourseId, userIdsToReset]
        );

        // Delete lesson progress for these users on this course.
        if (lessonIds.length > 0) {
            await db.query(
                `DELETE FROM user_progress WHERE lesson_id IN (?) AND user_id IN (?)`,
                [lessonIds, userIdsToReset]
            );
        }

        await db.query('COMMIT');
        
        return NextResponse.json({ success: true, message: `Progress for ${userIdsToReset.length} user(s) has been reset for re-training.` });

    } catch (error) {
        await db.query('ROLLBACK').catch(e => console.error("Rollback failed:", e));
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to initiate re-training:", error);
        return NextResponse.json({ error: 'Failed to initiate re-training due to a server error', details }, { status: 500 });
    }
}
