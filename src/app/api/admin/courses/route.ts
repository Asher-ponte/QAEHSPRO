
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = await getDb()
    
    // 1. Get all courses
    const courses = await db.all(`SELECT id, title, category, startDate, endDate FROM courses ORDER BY title ASC`);

    // 2. Get total lessons for all courses
    const lessonsPerCourseResult = await db.all(`
        SELECT m.course_id, COUNT(l.id) as totalLessons
        FROM lessons l
        JOIN modules m ON l.module_id = m.id
        GROUP BY m.course_id
    `);
    const lessonsPerCourse = new Map(lessonsPerCourseResult.map(i => [i.course_id, i.totalLessons]));

    // 3. Get all enrollments and group them by course
    const enrollmentsResult = await db.all(`SELECT user_id, course_id FROM enrollments`);
    const enrollmentsByCourse: Record<number, number[]> = {};
    for (const e of enrollmentsResult) {
        if (!enrollmentsByCourse[e.course_id]) {
            enrollmentsByCourse[e.course_id] = [];
        }
        enrollmentsByCourse[e.course_id].push(e.user_id);
    }
    
    // 4. Get completed lessons per user per course
    const completedLessonsResult = await db.all(`
        SELECT m.course_id, up.user_id, COUNT(up.lesson_id) as completedLessons
        FROM user_progress up
        JOIN lessons l ON up.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE up.completed = 1
        GROUP BY m.course_id, up.user_id
    `);
    const completedLessonsMap = new Map<string, number>(); // key: 'courseId-userId'
    completedLessonsResult.forEach(r => {
        completedLessonsMap.set(`${r.course_id}-${r.user_id}`, r.completedLessons);
    });
    
    // 5. Combine everything
    const coursesWithCompletion = courses.map(course => {
        const totalLessons = lessonsPerCourse.get(course.id) || 0;
        const enrolledUsers = enrollmentsByCourse[course.id] || [];
        const enrolledCount = enrolledUsers.length;

        let completedUserCount = 0;
        if (totalLessons > 0 && enrolledCount > 0) {
            for (const userId of enrolledUsers) {
                const completedCount = completedLessonsMap.get(`${course.id}-${userId}`) || 0;
                if (completedCount === totalLessons) {
                    completedUserCount++;
                }
            }
        }
        
        const completionRate = enrolledCount > 0 ? Math.round((completedUserCount / enrolledCount) * 100) : 0;
        
        return {
            ...course,
            enrolledCount,
            completionRate
        };
    });

    return NextResponse.json(coursesWithCompletion)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch courses for admin' }, { status: 500 })
  }
}
