
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

    // 1. Get all courses the user is enrolled in.
    const enrolledCourses = await db.all(`
        SELECT 
            c.*
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE e.user_id = ?
    `, [userId]);


    if (enrolledCourses.length === 0) {
      return NextResponse.json({
        stats: { coursesCompleted: 0, skillsAcquired: 0 },
        myCourses: [],
      });
    }

    const courseIds = enrolledCourses.map(c => c.id);
    const courseIdsPlaceholder = courseIds.map(() => '?').join(',');

    // 2. Get all lessons for these courses, ordered correctly.
    const allLessons = await db.all(`
        SELECT l.id, m.course_id, m."order" as module_order, l."order" as lesson_order
        FROM lessons l
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id IN (${courseIdsPlaceholder})
        ORDER BY m.course_id, m."order", l."order"
    `, courseIds);

    // 3. Get all of the user's completed lessons for these courses.
    const completedLessonIdsResult = await db.all(`
        SELECT up.lesson_id
        FROM user_progress up
        JOIN lessons l ON up.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE up.user_id = ? AND up.completed = 1 AND m.course_id IN (${courseIdsPlaceholder})
    `, [userId, ...courseIds]);
    const completedLessonIds = new Set(completedLessonIdsResult.map(r => r.lesson_id));

    // 4. Get all completed certificates to count completed courses accurately
    const completedCertificates = await db.all(
        `SELECT course_id FROM certificates WHERE user_id = ? AND course_id IN (${courseIdsPlaceholder})`,
        [userId, ...courseIds]
    );
    const completedCourseIds = new Set(completedCertificates.map(c => c.course_id));

    // 5. Process the data in memory.
    const lessonsByCourse = allLessons.reduce((acc, l) => {
        if (!acc[l.course_id]) acc[l.course_id] = [];
        acc[l.course_id].push(l);
        return acc;
    }, {} as Record<number, typeof allLessons>);

    const skillsAcquired = new Set<string>();
    
    const myCourses = enrolledCourses.map(course => {
        const courseLessons = lessonsByCourse[course.id] || [];
        const totalLessons = courseLessons.length;
        const completedCount = courseLessons.filter(l => completedLessonIds.has(l.id)).length;

        let progress = 0;
        if (totalLessons > 0) {
             // If a certificate exists, the course is 100% complete, otherwise calculate progress.
            if(completedCourseIds.has(course.id)) {
                progress = 100;
            } else {
                progress = Math.floor((completedCount / totalLessons) * 100);
            }
        }
        
        if (progress === 100) {
            skillsAcquired.add(course.category);
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
        coursesCompleted: completedCourseIds.size,
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
