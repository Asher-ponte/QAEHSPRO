import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    // Hardcode user ID to 1 since login is removed
    const userId = 1;

    // A single, more comprehensive query to get all course progress data
    const coursesProgress = await db.all(`
        SELECT
            c.id,
            c.title,
            c.category,
            COUNT(l.id) as totalLessons,
            SUM(CASE WHEN up.completed = 1 THEN 1 ELSE 0 END) as completedLessons
        FROM courses c
        LEFT JOIN modules m ON c.id = m.course_id
        LEFT JOIN lessons l ON m.id = l.module_id
        LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = ?
        GROUP BY c.id, c.title, c.category
    `, userId);

    let coursesCompleted = 0;
    const skillsAcquired = new Set<string>();
    const myCourses = [];

    for (const course of coursesProgress) {
        const total = course.totalLessons || 0;
        const completed = course.completedLessons || 0;
        
        if (total === 0) {
            continue;
        }

        if (completed === total) {
            coursesCompleted++;
            skillsAcquired.add(course.category);
        }

        if (completed > 0 && completed < total) {
            const progress = Math.floor((completed / total) * 100);
            myCourses.push({
                id: course.id,
                title: course.title,
                category: course.category,
                progress: progress,
            });
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
