
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function GET(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    const { user, siteId } = await getCurrentSession();
    if (user?.role !== 'Admin' || !siteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const db = await getDb();
        const { userId } = params;

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const [enrollmentRows] = await db.query<RowDataPacket[]>(`
            SELECT e.course_id FROM enrollments e
            JOIN users u ON e.user_id = u.id
            WHERE e.user_id = ? AND u.site_id = ?
        `, [userId, siteId]);
        
        const enrolledCourseIds = enrollmentRows.map(e => e.course_id);
        
        return NextResponse.json(enrolledCourseIds);
    } catch (error) {
        console.error("Failed to fetch user enrollments:", error);
        return NextResponse.json({ error: 'Failed to fetch user enrollments' }, { status: 500 });
    }
}
