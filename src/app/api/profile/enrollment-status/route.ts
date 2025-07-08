
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export async function GET(request: NextRequest) {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId) {
        return NextResponse.json({ userCourseIds: [] });
    }

    try {
        const db = await getDb(siteId);
        
        const enrolledCourses = await db.all(
            `SELECT course_id FROM enrollments WHERE user_id = ?`,
            [user.id]
        );
        const enrolledCourseIds = enrolledCourses.map(e => e.course_id);

        let pendingCourseIds: number[] = [];
        if (user.type === 'External') {
             const pendingTransactions = await db.all(
                `SELECT course_id FROM transactions WHERE user_id = ? AND status IN ('pending', 'completed')`,
                [user.id]
            );
            pendingCourseIds = pendingTransactions.map(t => t.course_id);
        }

        // Return a set of all courses the user has started interacting with (paid or pending)
        const allUserCourseIds = [...new Set([...enrolledCourseIds, ...pendingCourseIds])];

        return NextResponse.json({ userCourseIds: allUserCourseIds });

    } catch (error) {
        console.error("Failed to fetch enrollment status:", error);
        return NextResponse.json({ error: 'Failed to fetch enrollment status' }, { status: 500 });
    }
}
