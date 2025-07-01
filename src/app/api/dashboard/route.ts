
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
    const allCoursesForStats = await db.all('SELECT id, category FROM courses');
    let coursesCompleted = 0;
    const skillsAcquired = new Set<string>();
    
    for (const course of allCoursesForStats) {
        const totalLessonsResult = await db.get(`
            SELECT COUNT(l.id) as count 
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id = ?
        `, course.id);
        const totalLessons = totalLessonsResult?.count || 0;

        if (totalLessons === 0) continue;
        
        const completedLessonsResult = await db.get(`
            SELECT COUNT(up.lesson_id) as count
            FROM user_progress up
            JOIN lessons l ON up.lesson_id = l.id
            JOIN modules m ON l.module_id = m.id
            WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1
        `, [userId, course.id]);
        const completedLessons = completedLessonsResult?.count || 0;
        
        if (totalLessons > 0 && totalLessons === completedLessons) {
            coursesCompleted++;
            skillsAcquired.add(course.category);
        }
    }
    
    // --- Calculate My Courses with Progress ---
    const allCoursesForProgress = await db.all('SELECT * FROM courses');
    const coursesWithProgress = [];

    for (const course of allCoursesForProgress) {
        const totalLessonsResult = await db.get(`
            SELECT COUNT(l.id) as count 
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id = ?
        `, course.id);
        const totalLessons = totalLessonsResult?.count || 0;

        if (totalLessons === 0) {
            continue; // Skip courses without lessons
        }
        
        const completedLessonsResult = await db.get(`
            SELECT COUNT(up.lesson_id) as count
            FROM user_progress up
            JOIN lessons l ON up.lesson_id = l.id
            JOIN modules m ON l.module_id = m.id
            WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1
        `, [userId, course.id]);
        const completedLessons = completedLessonsResult?.count || 0;

        // We want to show courses the user has started but not yet completed.
        if (completedLessons > 0) {
            const progress = Math.floor((completedLessons / totalLessons) * 100);
            if (progress < 100) {
                coursesWithProgress.push({ ...course, progress });
            }
        }
    }

    return NextResponse.json({
        stats: {
            coursesCompleted,
            skillsAcquired: skillsAcquired.size,
        },
        myCourses: coursesWithProgress.slice(0, 3), // Ensure we only send 3
    });

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'An unexpected error occurred while fetching dashboard data.' }, { status: 500 })
  }
}
