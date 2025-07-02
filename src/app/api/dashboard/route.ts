
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

    // 1. Get all courses that the user has interacted with, and find the most recent interaction time for sorting.
    const courses = await db.all(`
      SELECT
        c.*,
        MAX(up.last_accessed_at) as lastAccessed
      FROM courses c
      JOIN modules m ON m.course_id = c.id
      JOIN lessons l ON l.module_id = m.id
      JOIN user_progress up ON up.lesson_id = l.id
      WHERE up.user_id = ?
      GROUP BY c.id
      ORDER BY lastAccessed DESC
    `, [userId]);

    // If the user has no progress at all, return empty dashboard data.
    if (courses.length === 0) {
      return NextResponse.json({
        stats: { coursesCompleted: 0, skillsAcquired: 0 },
        myCourses: [],
      });
    }

    const myCourses = [];
    const skillsAcquired = new Set<string>();
    let coursesCompletedCount = 0;

    // 2. For each of those courses, get the detailed progress info.
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
      if (totalLessons === 0) continue; // Skip courses with no lessons

      const progress = Math.floor((completedLessons.length / totalLessons) * 100);

      if (progress === 100) {
        coursesCompletedCount++;
        skillsAcquired.add(course.category);
      }

      // Find the first lesson in the course that is not marked as complete for the user.
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
        lastAccessed: course.lastAccessed,
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
