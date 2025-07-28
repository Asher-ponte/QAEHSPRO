
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentSession } from '@/lib/session';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export async function DELETE(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (user?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let db;
    try {
        db = await getDb();
        const courseId = parseInt(params.id, 10);
        if (isNaN(courseId)) {
            return NextResponse.json({ error: 'Course ID must be a number' }, { status: 400 });
        }

        await db.query('START TRANSACTION');
        
        const [moduleRows] = await db.query<RowDataPacket[]>('SELECT id FROM modules WHERE course_id = ?', [courseId]);
        if (moduleRows.length > 0) {
            const moduleIds = moduleRows.map(m => m.id);
            const [lessonRows] = await db.query<RowDataPacket[]>(`SELECT id FROM lessons WHERE module_id IN (?)`, [moduleIds]);
            if (lessonRows.length > 0) {
                const lessonIds = lessonRows.map(l => l.id);
                await db.query(`DELETE FROM user_progress WHERE lesson_id IN (?)`, [lessonIds]);
                await db.query(`DELETE FROM quiz_attempts WHERE lesson_id IN (?)`, [lessonIds]);
            }
            await db.query(`DELETE FROM lessons WHERE module_id IN (?)`, [moduleIds]);
        }
        
        await db.query('DELETE FROM modules WHERE course_id = ?', [courseId]);
        await db.query('DELETE FROM enrollments WHERE course_id = ?', [courseId]);
        await db.query('DELETE FROM final_assessment_attempts WHERE course_id = ?', [courseId]);
        await db.query('DELETE FROM course_signatories WHERE course_id = ?', [courseId]);
        // Do not delete certificates, they are a historical record. But we need to unlink them.
        await db.query('UPDATE certificates SET course_id = NULL WHERE course_id = ?', [courseId]);
        
        const [result] = await db.query<ResultSetHeader>('DELETE FROM courses WHERE id = ?', [courseId]);

        if (result.affectedRows === 0) {
             await db.query('ROLLBACK');
             return NextResponse.json({ error: 'Course not found or already deleted' }, { status: 404 });
        }
        
        await db.query('COMMIT');

        return NextResponse.json({ success: true, message: `Course ${courseId} and all its related data deleted successfully.` });

    } catch (error) {
        if (db) {
            await db.query('ROLLBACK').catch(console.error);
        }
        console.error("Failed to delete course:", error);
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: 'Failed to delete course due to a server error.', details }, { status: 500 });
    }
}
