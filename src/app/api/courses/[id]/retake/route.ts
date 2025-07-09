
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentSession } from '@/lib/session';

export async function POST(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let db;
    try {
        db = await getDb(siteId);
        const { id: courseIdStr } = params;
        const courseId = parseInt(courseIdStr, 10);
        const userId = user.id;

        if (isNaN(courseId)) {
            return NextResponse.json({ error: 'Invalid course ID.' }, { status: 400 });
        }
        
        await db.run('BEGIN TRANSACTION');

        // Get all lesson IDs for the course
        const lessons = await db.all(`
            SELECT l.id FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id = ?
        `, courseId);
        
        const lessonIds = lessons.map(l => l.id);

        if (lessonIds.length > 0) {
            const lessonIdsPlaceholder = lessonIds.map(() => '?').join(',');
            // Delete user progress for all lessons in this course
            await db.run(
                `DELETE FROM user_progress WHERE user_id = ? AND lesson_id IN (${lessonIdsPlaceholder})`,
                [userId, ...lessonIds]
            );
        }

        // Also delete previous final assessment attempts for this user and course
        await db.run(
            'DELETE FROM final_assessment_attempts WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );

        // We no longer delete the certificate. It remains as a historical record.
        // The user can now start the course again from 0% progress.
        
        await db.run('COMMIT');

        return NextResponse.json({ success: true, message: 'Course progress and assessment attempts have been reset.' });

    } catch (error) {
        if (db) {
            await db.run('ROLLBACK').catch(console.error);
        }
        console.error("Failed to reset course progress:", error);
        return NextResponse.json({ error: 'Failed to reset course progress.' }, { status: 500 });
    }
}
