
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const db = await getDb();
        const { id: courseId } = params;

        if (!courseId) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        // Get total number of lessons for the course
        const totalLessonsResult = await db.get(`
            SELECT COUNT(l.id) as count
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id = ?
        `, [courseId]);
        const totalLessons = totalLessonsResult?.count ?? 0;

        // Get all enrolled users for the course
        const enrolledUsers = await db.all(`
            SELECT u.id, u.username, u.fullName, u.department
            FROM users u
            JOIN enrollments e ON u.id = e.user_id
            WHERE e.course_id = ?
        `, [courseId]);

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
            `, [user.id, courseId]);

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
