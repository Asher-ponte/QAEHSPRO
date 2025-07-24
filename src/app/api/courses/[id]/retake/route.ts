
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function POST(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = await getDb();
    const connection = await db.getConnection();
    
    try {
        const { id: courseIdStr } = params;
        const courseId = parseInt(courseIdStr, 10);
        const userId = user.id;

        if (isNaN(courseId)) {
            return NextResponse.json({ error: 'Invalid course ID.' }, { status: 400 });
        }
        
        await connection.beginTransaction();

        // Get all lesson IDs for the course
        const [lessonRows] = await connection.query<RowDataPacket[]>(`
            SELECT l.id FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id = ?
        `, [courseId]);
        
        const lessonIds = lessonRows.map(l => l.id);

        if (lessonIds.length > 0) {
            const lessonIdsPlaceholder = lessonIds.map(() => '?').join(',');
            // Delete user progress for all lessons in this course
            await connection.query(
                `DELETE FROM user_progress WHERE user_id = ? AND lesson_id IN (${lessonIdsPlaceholder})`,
                [userId, ...lessonIds]
            );
        }

        // Also delete previous final assessment attempts for this user and course
        await connection.query(
            'DELETE FROM final_assessment_attempts WHERE user_id = ? AND course_id = ? AND site_id = ?',
            [userId, courseId, siteId]
        );

        // We no longer delete the certificate. It remains as a historical record.
        // The user can now start the course again from 0% progress.
        
        await connection.commit();

        return NextResponse.json({ success: true, message: 'Course progress and assessment attempts have been reset.' });

    } catch (error) {
        await connection.rollback();
        console.error("Failed to reset course progress:", error);
        return NextResponse.json({ error: 'Failed to reset course progress.' }, { status: 500 });
    } finally {
        connection.release();
    }
}
