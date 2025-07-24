

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

const enrollmentSchema = z.object({
  userId: z.number(),
  courseId: z.number(),
  siteId: z.string().optional(),
});

async function processEnrollment(request: NextRequest, isEnrolling: boolean) {
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (user?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const data = await request.json();
        const parsedData = enrollmentSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const { userId, courseId, siteId: targetSiteId } = parsedData.data;

        let effectiveSiteId = sessionSiteId;
        if (isSuperAdmin && targetSiteId) {
            effectiveSiteId = targetSiteId;
        } else if (targetSiteId && !isSuperAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        
        const db = await getDb();

        if (isEnrolling) {
            const [courseRows] = await db.query<RowDataPacket[]>('SELECT id FROM courses WHERE id = ? AND site_id = ? LIMIT 1', [courseId, effectiveSiteId]);
            const course = courseRows[0];
            if (!course) {
                return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
            }
            await db.query(
                'INSERT IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)',
                [userId, courseId]
            );
        } else {
            await db.query(
                'DELETE FROM enrollments WHERE user_id = ? AND course_id = ?',
                [userId, courseId]
            );
        }
        
        const message = isEnrolling ? 'User enrolled successfully.' : 'User un-enrolled successfully.';
        return NextResponse.json({ success: true, message }, { status: 200 });

    } catch (error) {
        const action = isEnrolling ? 'enroll' : 'un-enroll';
        console.error(`Failed to ${action} user:`, error);
        return NextResponse.json({ error: `Failed to ${action} user` }, { status: 500 });
    }
}


// Enroll a user in a course
export async function POST(request: NextRequest) {
    return processEnrollment(request, true);
}

// Un-enroll a user from a course
export async function DELETE(request: NextRequest) {
    return processEnrollment(request, false);
}
