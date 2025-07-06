
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export async function GET() {
  const { user, siteId } = await getCurrentSession();
  if (!user || !siteId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const userId = user.id;

  try {
    const db = await getDb(siteId);

    // 1. Get all courses the user is enrolled in.
    const enrolledCourses = await db.all(`
        SELECT 
            c.*
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE e.user_id = ?
    `, [userId]);

    // 2. Get stats
    const totalTrainingsResult = await db.get(
      'SELECT COUNT(*) as count FROM certificates WHERE user_id = ? AND type = ?',
      [userId, 'completion']
    );
    const totalTrainingsAttended = totalTrainingsResult.count;

    const totalRecognitionsResult = await db.get(
      'SELECT COUNT(*) as count FROM certificates WHERE user_id = ? AND type = ?',
      [userId, 'recognition']
    );
    const totalRecognitions = totalRecognitionsResult.count;

    const acquiredSkillsResult = await db.all(
        `SELECT DISTINCT c.category FROM certificates cert
         JOIN courses c ON cert.course_id = c.id
         WHERE cert.user_id = ?`,
        [userId]
    );
    const skillsAcquiredCount = acquiredSkillsResult.length;

    // 3. If no courses, return early.
    if (enrolledCourses.length === 0) {
      return NextResponse.json({
        stats: { totalTrainingsAttended, totalRecognitions, skillsAcquired: skillsAcquiredCount },
        courses: [],
      });
    }
    
    // 4. Get data for progress calculation of currently enrolled courses
    const courseIds = enrolledCourses.map(c => c.id);
    const courseIdsPlaceholder = courseIds.map(() => '?').join(',');

    const allLessons = await db.all(`
        SELECT l.id, m.course_id, m."order" as module_order, l."order" as lesson_order
        FROM lessons l
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id IN (${courseIdsPlaceholder})
        ORDER BY m.course_id, m."order", l."order"
    `, courseIds);

    const completedLessonIdsResult = await db.all(`
        SELECT up.lesson_id
        FROM user_progress up
        JOIN lessons l ON up.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE up.user_id = ? AND up.completed = 1 AND m.course_id IN (${courseIdsPlaceholder})
    `, [userId, ...courseIds]);
    const completedLessonIds = new Set(completedLessonIdsResult.map(r => r.lesson_id));

    // 5. Process the data in memory for course list.
    const lessonsByCourse = allLessons.reduce((acc, l) => {
        if (!acc[l.course_id]) acc[l.course_id] = [];
        acc[l.course_id].push(l);
        return acc;
    }, {} as Record<number, typeof allLessons>);
    
    const myCourses = enrolledCourses.map(course => {
        const courseLessons = lessonsByCourse[course.id] || [];
        const totalLessons = courseLessons.length;
        const completedCount = courseLessons.filter(l => completedLessonIds.has(l.id)).length;

        let progress = 0;
        if (totalLessons > 0) {
            progress = Math.floor((completedCount / totalLessons) * 100);
        }
        
        const firstUncompletedLesson = courseLessons.find(l => !completedLessonIds.has(l.id));
        const continueLessonId = firstUncompletedLesson?.id || courseLessons[0]?.id || null;

        return {
            id: course.id,
            title: course.title,
            category: course.category,
            imagePath: course.imagePath,
            progress: progress,
            continueLessonId: continueLessonId,
        };
    });
    
    const dashboardData = {
      stats: {
        totalTrainingsAttended,
        totalRecognitions,
        skillsAcquired: skillsAcquiredCount,
      },
      courses: myCourses,
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
