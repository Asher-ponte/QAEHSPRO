
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

    // 1. Get all of the user's progress records.
    // Using SELECT * and checking for the column in JS makes this resilient.
    const allUserProgress = await db.all('SELECT * FROM user_progress WHERE user_id = ?', [userId]);

    // If the user has no progress, return empty data.
    if (allUserProgress.length === 0) {
      return NextResponse.json({
        stats: { coursesCompleted: 0, skillsAcquired: 0 },
        myCourses: [],
      });
    }

    const progressMap = new Map(allUserProgress.map(p => [p.lesson_id, p]));
    const lessonIdsWithProgress = Array.from(progressMap.keys());

    // 2. Get the course info for each lesson the user has touched.
    const courseInfoForLessons = await db.all(`
      SELECT
        l.id as lesson_id,
        m.course_id,
        c.title,
        c.category,
        c.image,
        c.aiHint
      FROM lessons l
      JOIN modules m ON l.module_id = m.id
      JOIN courses c ON m.course_id = c.id
      WHERE l.id IN (${lessonIdsWithProgress.map(() => '?').join(',')})
    `, lessonIdsWithProgress);

    // 3. Group lessons by course
    const courseDataMap = new Map();
    for (const lessonInfo of courseInfoForLessons) {
        if (!courseDataMap.has(lessonInfo.course_id)) {
            courseDataMap.set(lessonInfo.course_id, {
                id: lessonInfo.course_id,
                title: lessonInfo.title,
                category: lessonInfo.category,
                image: lessonInfo.image,
                aiHint: lessonInfo.aiHint,
                lessons: [], // We'll populate this next
            });
        }
    }

    // 4. Get ALL lessons for the courses the user has started.
    // This is needed to accurately calculate total progress (e.g., 1 out of 10 lessons).
    const courseIds = Array.from(courseDataMap.keys());
    const allLessonsForCourses = await db.all(`
        SELECT l.id, m.course_id
        FROM lessons l
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id IN (${courseIds.map(() => '?').join(',')})
        ORDER BY m."order", l."order"
    `, courseIds);

    for (const lesson of allLessonsForCourses) {
        if (courseDataMap.has(lesson.course_id)) {
            courseDataMap.get(lesson.course_id).lessons.push(lesson);
        }
    }

    // 5. Process the data in JavaScript
    let coursesCompleted = 0;
    const skillsAcquired = new Set<string>();
    const myCourses = [];

    for (const course of courseDataMap.values()) {
      const totalLessons = course.lessons.length;
      if (totalLessons === 0) continue;

      let completedLessons = 0;
      let lastAccessedTimestamp = 0;

      for (const lesson of course.lessons) {
        const progressRecord = progressMap.get(lesson.id);
        if (progressRecord) {
          if (progressRecord.completed) {
            completedLessons++;
          }
          // Safely check for the `last_accessed_at` property
          if (progressRecord.last_accessed_at) {
            const ts = new Date(progressRecord.last_accessed_at).getTime();
            if (ts > lastAccessedTimestamp) {
              lastAccessedTimestamp = ts;
            }
          }
        }
      }

      const progress = Math.floor((completedLessons / totalLessons) * 100);
      if (progress === 100) {
        coursesCompleted++;
        skillsAcquired.add(course.category);
      }

      const firstUncompletedLesson = course.lessons.find(l => !progressMap.get(l.id)?.completed);

      myCourses.push({
        id: course.id,
        title: course.title,
        category: course.category,
        image: course.image,
        aiHint: course.aiHint,
        progress: progress,
        lastAccessed: lastAccessedTimestamp > 0 ? new Date(lastAccessedTimestamp).toISOString() : null,
        continueLessonId: firstUncompletedLesson?.id || null,
      });
    }

    // 6. Sort by last accessed date
    myCourses.sort((a, b) => {
      const dateA = a.lastAccessed ? new Date(a.lastAccessed).getTime() : 0;
      const dateB = b.lastAccessed ? new Date(b.lastAccessed).getTime() : 0;
      return dateB - dateA;
    });

    const dashboardData = {
      stats: {
        coursesCompleted: coursesCompleted,
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
