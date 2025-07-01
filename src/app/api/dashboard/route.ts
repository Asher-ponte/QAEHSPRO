
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

    // Defensive check for invalid session ID
    if (isNaN(userId)) {
        return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // --- Fetch all data needed ---
    const allCourses = await db.all('SELECT id, title, category FROM courses');
    
    // Get all lessons, joining with modules to find the parent course.
    const allLessons = await db.all(`
        SELECT 
            l.id as lesson_id, 
            m.course_id 
        FROM lessons l
        JOIN modules m ON l.module_id = m.id
    `);
    
    // Get the current user's completed lessons.
    const userProgress = await db.all(
        'SELECT lesson_id FROM user_progress WHERE user_id = ? AND completed = 1', 
        userId
    );
    const completedLessonIds = new Set(userProgress.map(p => p.lesson_id));

    // --- Process data in JavaScript for robustness ---

    // 1. Create a map of course ID -> total number of lessons
    const courseLessonCounts: { [courseId: number]: number } = {};
    for (const lesson of allLessons) {
        courseLessonCounts[lesson.course_id] = (courseLessonCounts[lesson.course_id] || 0) + 1;
    }
    
    // 2. Create a map of course ID -> number of *completed* lessons for the user
    const courseCompletedLessonCounts: { [courseId: number]: number } = {};
    for (const lesson of allLessons) {
        if (completedLessonIds.has(lesson.lesson_id)) {
            courseCompletedLessonCounts[lesson.course_id] = (courseCompletedLessonCounts[lesson.course_id] || 0) + 1;
        }
    }

    let coursesCompleted = 0;
    const skillsAcquired = new Set<string>();
    const myCourses = [];

    // 3. Iterate through all courses to calculate final stats and progress
    for (const course of allCourses) {
        const totalLessons = courseLessonCounts[course.id] || 0;
        const completedLessons = courseCompletedLessonCounts[course.id] || 0;

        if (totalLessons > 0) {
            // Calculate completion stats
            if (completedLessons === totalLessons) {
                coursesCompleted++;
                skillsAcquired.add(course.category);
            }

            // Calculate progress for "My Courses" list (in-progress courses)
            if (completedLessons > 0 && completedLessons < totalLessons) {
                const progress = Math.floor((completedLessons / totalLessons) * 100);
                myCourses.push({
                    id: course.id,
                    title: course.title,
                    category: course.category,
                    progress: progress,
                });
            }
        }
    }

    const dashboardData = {
        stats: {
            coursesCompleted: coursesCompleted,
            skillsAcquired: skillsAcquired.size,
        },
        myCourses: myCourses.slice(0, 3), // Limit to 3 courses
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Error in /api/dashboard route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown internal error occurred';
    return NextResponse.json({ 
        error: 'Failed to fetch dashboard data due to a server error.',
        details: errorMessage
    }, { status: 500 });
  }
}
