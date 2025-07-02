
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

    // Get all courses that the user has started (i.e., has an entry in user_progress).
    const courses = await db.all(`
        SELECT DISTINCT c.*
        FROM courses c
        JOIN modules m ON m.course_id = c.id
        JOIN lessons l ON l.module_id = m.id
        JOIN user_progress up ON up.lesson_id = l.id
        WHERE up.user_id = ?
      `, [userId]);


    if (courses.length === 0) {
      return NextResponse.json({
        stats: { coursesCompleted: 0, skillsAcquired: 0 },
        myCourses: [],
      });
    }

    const myCourses = [];
    const skillsAcquired = new Set<string>();
    let coursesCompletedCount = 0;

    for (const course of courses) {
      const allLessons = await db.all(
        'SELECT l.id FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ?',
        [course.id]
      );
      
      const completedLessons = await db.all(
        `SELECT l.id FROM lessons l 
         JOIN user_progress up ON l.id = up.lesson_id 
         JOIN modules m ON l.module_id = m.id 
         WHERE m.course_id = ? AND up.user_id = ? AND up.completed = 1`,
        [course.id, userId]
      );

      const totalLessons = allLessons.length;
      if (totalLessons === 0) continue; 

      const progress = Math.floor((completedLessons.length / totalLessons) * 100);

      if (progress === 100) {
        coursesCompletedCount++;
        skillsAcquired.add(course.category);
      }

      const firstUncompletedLessonResult = await db.get(
        `SELECT l.id FROM lessons l
         JOIN modules m ON l.module_id = m.id
         WHERE m.course_id = ? AND l.id NOT IN (
           SELECT up2.lesson_id from user_progress up2 
           WHERE up2.user_id = ? AND up2.completed = 1 AND up2.lesson_id IS NOT NULL
         )
         ORDER BY m."order", l."order"
         LIMIT 1`,
        [course.id, userId]
      );

      myCourses.push({
        id: course.id,
        title: course.title,
        category: course.category,
        image: course.image,
        aiHint: course.aiHint,
        progress: progress,
        continueLessonId: firstUncompletedLessonResult?.id || allLessons[0]?.id || null,
      });
    }
    
    const dashboardData = {
      stats: {
        coursesCompleted: coursesCompletedCount,
        skillsAcquired: skillsAcquired.size,
      },
      myCourses: myCourses,
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
