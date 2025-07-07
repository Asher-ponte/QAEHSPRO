
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

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

    if (isSuperAdmin && requestedSiteId) {
        effectiveSiteId = requestedSiteId;
    } else if (requestedSiteId && !isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const db = await getDb(effectiveSiteId);
        const { id: courseId } = params;

        if (!courseId) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        const enrollments = await db.all(`
            SELECT user_id FROM enrollments WHERE course_id = ?
        `, [courseId]);
        
        const enrolledUserIds = enrollments.map(e => e.user_id);
        
        return NextResponse.json(enrolledUserIds);
    } catch (error) {
        console.error("Failed to fetch course enrollments:", error);
        return NextResponse.json({ error: 'Failed to fetch course enrollments' }, { status: 500 });
    }
}
