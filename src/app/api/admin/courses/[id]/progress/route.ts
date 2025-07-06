
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

    try {
        const searchParams = request.nextUrl.searchParams;
        const targetSiteId = searchParams.get('targetSiteId');
        const courseTitle = searchParams.get('courseTitle');
        
        let effectiveSiteId = sessionSiteId;
        let effectiveCourseId = parseInt(params.id, 10);

        if (isSuperAdmin && targetSiteId && courseTitle) {
            effectiveSiteId = targetSiteId;
            const db = await getDb(effectiveSiteId);
            const course = await db.get('SELECT id FROM courses WHERE title = ?', courseTitle);
            if (!course) {
                // If the course with that title doesn't exist in the target branch, return empty progress.
                return NextResponse.json([]); 
            }
            effectiveCourseId = course.id;
        }

        const db = await getDb(effectiveSiteId);

        // Get total number of lessons for the course
        const totalLessonsResult = await db.get(`
            SELECT COUNT(l.id) as count
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id = ?
        `, [effectiveCourseId]);
        const totalLessons = totalLessonsResult?.count ?? 0;

        // Get all enrolled users for the course
        const enrolledUsers = await db.all(`
            SELECT u.id, u.username, u.fullName, u.department
            FROM users u
            JOIN enrollments e ON u.id = e.user_id
            WHERE e.course_id = ?
        `, [effectiveCourseId]);

        if (enrolledUsers.length === 0) {
            return NextResponse.json([]);
        }

        if (totalLessons === 0) {
            return NextResponse.json(enrolledUsers.map(u => ({
                id: u.id,
                username: u.username,
                fullName: u.fullName || u.username,
                department: u.department || 'N/A',
                progress: 0
            })));
        }

        // Get progress for each enrolled user
        const progressData = [];
        for (const user of enrolledUsers) {
            const completedLessonsResult = await db.get(`
                SELECT COUNT(up.lesson_id) as count
                FROM user_progress up
                JOIN lessons l ON up.lesson_id = l.id
                JOIN modules m ON l.module_id = m.id
                WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1
            `, [user.id, effectiveCourseId]);

            const completedLessons = completedLessonsResult?.count ?? 0;
            const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

            progressData.push({
                id: user.id,
                username: user.username,
                fullName: user.fullName || user.username,
                department: user.department || 'N/A',
                progress: progress,
            });
        }

        return NextResponse.json(progressData);

    } catch (error) {
        console.error("Failed to fetch course progress:", error);
        return NextResponse.json({ error: 'Failed to fetch course progress' }, { status: 500 });
    }
}
