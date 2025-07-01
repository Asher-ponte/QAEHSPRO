import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const db = await getDb()
    const cookieStore = cookies()
    const sessionId = cookieStore.get('session')?.value

    if (!sessionId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const userId = parseInt(sessionId, 10);


    // --- Calculate Stats ---
    const allCourses = await db.all('SELECT id, category FROM courses');
    let coursesCompleted = 0;
    const skillsAcquired = new Set<string>();
    
    for (const course of allCourses) {
        // Get total lessons for the course
        const totalLessonsResult = await db.get(`
            SELECT COUNT(l.id) as count 
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id = ?
        `, course.id);
        const totalLessons = totalLessonsResult.count;

        if (totalLessons === 0) {
            continue;
        }
        
        // Get completed lessons for the user in this course
        const completedLessonsResult = await db.get(`
            SELECT COUNT(up.lesson_id) as count
            FROM user_progress up
            JOIN lessons l ON up.lesson_id = l.id
            JOIN modules m ON l.module_id = m.id
            WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1
        `, [userId, course.id]);
        const completedLessons = completedLessonsResult.count;
        
        if (totalLessons === completedLessons) {
            coursesCompleted++;
            skillsAcquired.add(course.category);
        }
    }
    
    // --- Calculate My Courses with Progress ---
    const inProgressCourses = await db.all(`
        SELECT DISTINCT c.id, c.title, c.category
        FROM courses c
        JOIN modules m ON c.id = m.course_id
        JOIN lessons l ON m.id = l.module_id
        JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = ?
        LIMIT 3
    `, userId);

    const coursesWithProgress = [];
    for (const course of inProgressCourses) {
        const totalLessonsResult = await db.get(`
            SELECT COUNT(l.id) as count 
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id = ?
        `, course.id);
        const totalLessons = totalLessonsResult.count;
        
        let progress = 0;
        if (totalLessons > 0) {
            const completedLessonsResult = await db.get(`
                SELECT COUNT(up.lesson_id) as count
                FROM user_progress up
                JOIN lessons l ON up.lesson_id = l.id
                JOIN modules m ON l.module_id = m.id
                WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1
            `, [userId, course.id]);
            const completedLessons = completedLessonsResult.count;
            progress = Math.floor((completedLessons / totalLessons) * 100);
        }
        coursesWithProgress.push({ ...course, progress });
    }

    return NextResponse.json({
        stats: {
            coursesCompleted,
            skillsAcquired: skillsAcquired.size,
        },
        myCourses: coursesWithProgress,
    });

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
