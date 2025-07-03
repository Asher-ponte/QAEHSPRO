
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';

const bulkEnrollmentSchema = z.object({
  courseId: z.number(),
  userIds: z.array(z.number()),
  action: z.enum(['enroll', 'unenroll']),
});

export async function POST(request: NextRequest) {
    let db;
    let actionForErrorMessage = 'process';

    try {
        db = await getDb();
        const data = await request.json();
        const parsedData = bulkEnrollmentSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }

        const { courseId, userIds, action } = parsedData.data;
        actionForErrorMessage = action;

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

    