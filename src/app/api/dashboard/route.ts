
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const db = await getDb();
    const cookieStore = cookies();
    const sessionId = cookieStore.get('session')?.value;

    if (!sessionId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const userId = parseInt(sessionId, 10);

    const coursesWithProgress = await db.all(`
        SELECT
            c.id,
            c.title,
            c.category,
            (SELECT COUNT(l.id) FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = c.id) as totalLessons,
            COUNT(up.lesson_id) as completedLessons
        FROM course_enrollments ce
        JOIN courses c ON ce.course_id = c.id
        LEFT JOIN (
            SELECT l.id as lesson_id, m.course_id FROM lessons l JOIN modules m ON l.module_id = m.id
        ) l ON l.course_id = c.id
        LEFT JOIN user_progress up ON up.lesson_id = l.lesson_id AND up.user_id = ce.user_id AND up.completed = 1
        WHERE ce.user_id = ?
        GROUP BY c.id
    `, userId);

    let coursesCompleted = 0;
    const skillsAcquired = new Set<string>();
    const myCourses = [];

    for (const course of coursesWithProgress) {
        const total = course.totalLessons;
        const completed = course.completedLessons;

        if (total === 0) {
             myCourses.push({
                id: course.id,
                title: course.title,
                category: course.category,
                progress: 0,
            });
            continue; 
        }
        
        const progress = Math.floor((completed / total) * 100);

        myCourses.push({
            id: course.id,
            title: course.title,
            category: course.category,
            progress: progress,
        });

        if (completed === total) {
            coursesCompleted++;
            skillsAcquired.add(course.category);
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
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data due to a server error.', details: errorMessage },
      { status: 500 }
    );
  }
}
