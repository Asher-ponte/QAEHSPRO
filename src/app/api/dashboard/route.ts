
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const userId = user.id;
  
  try {
    const db = await getDb();
    
    const coursesWithProgress = await db.all(`
        SELECT
            c.id,
            c.title,
            c.category,
            (SELECT COUNT(l.id) FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = c.id) as totalLessons,
            (SELECT COUNT(up.id) FROM user_progress up JOIN lessons l ON up.lesson_id = l.id JOIN modules m ON l.module_id = m.id WHERE m.course_id = c.id AND up.user_id = ? AND up.completed = 1) as completedLessons
        FROM courses c
        WHERE c.id IN (
            SELECT DISTINCT m.course_id
            FROM user_progress up
            JOIN lessons l ON up.lesson_id = l.id
            JOIN modules m ON l.module_id = m.id
            WHERE up.user_id = ?
        )
    `, [userId, userId]);

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

        if (progress === 100) {
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
