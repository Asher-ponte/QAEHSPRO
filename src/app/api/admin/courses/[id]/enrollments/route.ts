
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (user?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    let effectiveSiteId = sessionSiteId;
    const requestedSiteId = request.nextUrl.searchParams.get('siteId');

    // Super admin can specify any site.
    if (isSuperAdmin && requestedSiteId) {
        effectiveSiteId = requestedSiteId;
    // A branch admin can ONLY request for their OWN site.
    } else if (requestedSiteId && !isSuperAdmin && requestedSiteId !== sessionSiteId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else if (requestedSiteId) {
        effectiveSiteId = requestedSiteId;
    }

    try {
        const db = await getDb();
        const { id: courseId } = params;

        if (!courseId) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        const [enrollments] = await db.query<RowDataPacket[]>(`
            SELECT user_id FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            WHERE e.course_id = ? AND c.site_id = ?
        `, [courseId, effectiveSiteId]);
        
        const enrolledUserIds = enrollments.map(e => e.user_id);
        
        return NextResponse.json(enrolledUserIds);
    } catch (error) {
        console.error("Failed to fetch course enrollments:", error);
        return NextResponse.json({ error: 'Failed to fetch course enrollments' }, { status: 500 });
    }
}
