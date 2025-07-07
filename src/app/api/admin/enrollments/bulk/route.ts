
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

    let db;
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
        
        db = await getDb(effectiveSiteId);

        if (userIds.length === 0) {
            return NextResponse.json({ success: true, message: 'No users to update.' });
        }

        await db.run('BEGIN TRANSACTION');

        if (action === 'enroll') {
            const stmt = await db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)');
            for (const userId of userIds) {
                await stmt.run(userId, courseId);
            }
            await stmt.finalize();
        } else if (action === 'unenroll') {
            const placeholders = userIds.map(() => '?').join(',');
            await db.run(
                `DELETE FROM enrollments WHERE course_id = ? AND user_id IN (${placeholders})`,
                [courseId, ...userIds]
            );
        }

        await db.run('COMMIT');

        return NextResponse.json({ success: true, message: `Bulk ${action} successful.` }, { status: 200 });

    } catch (error) {
        if (db) {
            await db.run('ROLLBACK').catch(console.error);
        }
        console.error(`Failed to bulk ${actionForErrorMessage} users:`, error);
        return NextResponse.json({ error: `Failed to bulk ${actionForErrorMessage} users` }, { status: 500 });
    }
}
