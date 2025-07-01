
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

export async function POST(
    request: NextRequest, 
    { params }: { params: { lessonId: string, id: string } }
) {
    const db = await getDb()
    const userId = 1; // Hardcoded user
    const { lessonId, id: courseId } = params;

    try {
        // Use a transaction to ensure atomicity
        await db.run('BEGIN TRANSACTION');

        // Mark current lesson as complete
        const existingProgress = await db.get(
            'SELECT id FROM user_progress WHERE user_id = ? AND lesson_id = ?',
            [userId, lessonId]
        );

        if (!existingProgress) {
             await db.run(
                'INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (?, ?, 1)',
                [userId, lessonId]
            );
        } else {
             await db.run(
                'UPDATE user_progress SET completed = 1 WHERE id = ?',
                [existingProgress.id]
            );
        }

        // Find the next lesson in the course
        const allLessons = await db.all(
            `SELECT l.id FROM lessons l
             JOIN modules m ON l.module_id = m.id
             WHERE m.course_id = ?
             ORDER BY m."order" ASC, l."order" ASC`,
            [courseId]
        );

        const currentIndex = allLessons.findIndex(l => l.id === parseInt(lessonId, 10));

        let nextLessonId: number | null = null;
        if (currentIndex !== -1 && currentIndex < allLessons.length - 1) {
            nextLessonId = allLessons[currentIndex + 1].id;
        }
        
        await db.run('COMMIT');

        return NextResponse.json({ success: true, nextLessonId });

    } catch (error) {
        await db.run('ROLLBACK');
        console.error("Failed to mark lesson as complete:", error);
        return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
    }
}

    