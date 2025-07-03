
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/session';

export async function POST(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    let db;
    try {
        db = await getDb();
        const { id: courseId } = params;

        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        const userId = user.id;
        
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

        // We no longer delete the certificate. It remains as a historical record.
        // The user can now start the course again from 0% progress.
        
        await db.run('COMMIT');

        return NextResponse.json({ success: true, message: 'Course progress reset.' });

    } catch (error) {
        if (db) {
            await db.run('ROLLBACK').catch(console.error);
        }
        console.error("Failed to reset course progress:", error);
        return NextResponse.json({ error: 'Failed to reset course progress.' }, { status: 500 });
    }
}
