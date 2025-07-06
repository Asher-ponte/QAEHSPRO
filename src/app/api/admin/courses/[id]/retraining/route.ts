
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (user?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    let db;
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
            const targetDb = await getDb(effectiveSiteId);
            const course = await targetDb.get('SELECT id FROM courses WHERE title = ?', courseTitle);

            if (!course) {
                 return NextResponse.json({ error: `Course "${courseTitle}" not found in the selected branch.` }, { status: 404 });
            }
            effectiveCourseId = course.id;
        }

        db = await getDb(effectiveSiteId);

        if (isNaN(effectiveCourseId)) {
            return NextResponse.json({ error: 'Course ID must be a number.' }, { status: 400 });
        }

        await db.run('BEGIN TRANSACTION');

        const lessons = await db.all(`
            SELECT l.id FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id = ?
        `, effectiveCourseId);
        
        const lessonIds = lessons.map(l => l.id);
        const totalLessons = lessonIds.length;

        if (totalLessons === 0) {
            await db.run('COMMIT');
            return NextResponse.json({ success: true, message: 'Course has no lessons, so no progress to reset.' });
        }
        
        const enrolledUsers = await db.all(`SELECT user_id FROM enrollments WHERE course_id = ?`, effectiveCourseId);
        if (enrolledUsers.length === 0) {
            await db.run('COMMIT');
            return NextResponse.json({ success: true, message: 'No users are enrolled in this course.' });
        }
        const enrolledUserIds = enrolledUsers.map(u => u.user_id);

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
        
        const lessonIdsPlaceholder = lessonIds.map(() => '?').join(',');
        const userIdsPlaceholder = userIdsToReset.map(() => '?').join(',');

        await db.run(
            `DELETE FROM user_progress WHERE lesson_id IN (${lessonIdsPlaceholder}) AND user_id IN (${userIdsPlaceholder})`,
            [...lessonIds, ...userIdsToReset]
        );

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
