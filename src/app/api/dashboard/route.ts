import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    const userId = 1; // Hardcoded user

    // Get all courses that the user has any progress in (started or completed).
    const coursesWithProgress = await db.all(`
      SELECT
        c.id,
        c.title,
        c.category,
        -- Calculate total lessons for the course
        (SELECT COUNT(l.id) FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = c.id) as totalLessons,
        -- Calculate completed lessons for the user in this course
        SUM(CASE WHEN up.completed = 1 THEN 1 ELSE 0 END) as completedLessons
      FROM user_progress up
      JOIN lessons l ON up.lesson_id = l.id
      JOIN modules m ON l.module_id = m.id
      JOIN courses c ON m.course_id = c.id
      WHERE up.user_id = ?
      GROUP BY c.id, c.title, c.category
    `, userId);

    let coursesCompleted = 0;
    const skillsAcquired = new Set<string>();
    const myCourses = [];

    for (const course of coursesWithProgress) {
        const total = course.totalLessons || 0;
        const completed = course.completedLessons || 0;

        if (total === 0) {
            continue; // Skip courses with no lessons
        }

        if (completed === total) {
            coursesCompleted++;
            skillsAcquired.add(course.category);
        } else {
            // This now includes courses with 0% progress (started but no lessons completed)
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
