
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';

const bulkEnrollmentSchema = z.object({
  courseId: z.number(),
  userIds: z.array(z.number()),
  action: z.enum(['enroll', 'unenroll']),
  siteId: z.string().optional(),
});

export async function POST(request: NextRequest) {
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (user?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let connection;
    let actionForErrorMessage = 'process';

    try {
        const data = await request.json();
        const parsedData = bulkEnrollmentSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }

        const { courseId, userIds, action, siteId: targetSiteId } = parsedData.data;
        actionForErrorMessage = action;

        let effectiveSiteId = sessionSiteId;
        if (isSuperAdmin && targetSiteId) {
            effectiveSiteId = targetSiteId;
        } else if (targetSiteId && !isSuperAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        
        const pool = await getDb();
        connection = await pool.getConnection();
        await connection.beginTransaction();

        if (userIds.length === 0) {
            await connection.commit();
            connection.release();
            return NextResponse.json({ success: true, message: 'No users to update.' });
        }
        
        if (action === 'enroll') {
            // For enrolling, we need to ensure the course exists in the target site
             const [courseRows]: any = await connection.query('SELECT id FROM courses WHERE id = ? AND site_id = ?', [courseId, effectiveSiteId]);
             if (courseRows.length === 0) {
                 throw new Error("Course does not exist in the specified branch.");
             }
            // Prepare a query for batch insert, ignoring duplicates
            const values = userIds.map(userId => [userId, courseId]);
            await connection.query('INSERT IGNORE INTO enrollments (user_id, course_id) VALUES ?', [values]);
        } else if (action === 'unenroll') {
            const placeholders = userIds.map(() => '?').join(',');
            await connection.query(
                `DELETE FROM enrollments WHERE course_id = ? AND user_id IN (${placeholders})`,
                [courseId, ...userIds]
            );
        }

        await connection.commit();
        connection.release();

        return NextResponse.json({ success: true, message: `Bulk ${action} successful.` }, { status: 200 });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error(`Failed to bulk ${actionForErrorMessage} users:`, error);
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: `Failed to bulk ${actionForErrorMessage} users`, details }, { status: 500 });
    }
}
