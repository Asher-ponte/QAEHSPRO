
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

export async function DELETE(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const db = await getDb()
    const { id: courseId } = params

    if (!courseId) {
        return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    try {
        await db.run('BEGIN TRANSACTION');

        const lessons = await db.all(
            'SELECT l.id FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ?',
            [courseId]
        );
        const lessonIds = lessons.map(l => l.id);

        if (lessonIds.length > 0) {
            const progressPlaceholders = lessonIds.map(() => '?').join(',');
            await db.run(`DELETE FROM user_progress WHERE lesson_id IN (${progressPlaceholders})`, lessonIds);
        }

        const moduleIdsResult = await db.all('SELECT id FROM modules WHERE course_id = ?', [courseId]);
        const moduleIds = moduleIdsResult.map(m => m.id);

        if (moduleIds.length > 0) {
            const lessonPlaceholders = moduleIds.map(() => '?').join(',');
            await db.run(`DELETE FROM lessons WHERE module_id IN (${lessonPlaceholders})`, moduleIds);
        }
        
        await db.run('DELETE FROM modules WHERE course_id = ?', [courseId]);

        const result = await db.run('DELETE FROM courses WHERE id = ?', [courseId]);

        await db.run('COMMIT');

        if (result.changes === 0) {
             await db.run('ROLLBACK');
             return NextResponse.json({ error: 'Course not found or already deleted' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: `Course ${courseId} deleted successfully.` });

    } catch (error) {
        await db.run('ROLLBACK');
        console.error("Failed to delete course:", error);
        return NextResponse.json({ error: 'Failed to delete course due to a server error' }, { status: 500 });
    }
}
