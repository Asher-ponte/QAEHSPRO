
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentSession } from '@/lib/session';

export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string; lessonId: string } }
) {
  const { user, siteId } = await getCurrentSession();
  if (!user || !siteId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const db = await getDb(siteId);
    const { id: courseId, lessonId: currentLessonIdStr } = params
    const currentLessonId = parseInt(currentLessonIdStr, 10);
    
    const userId = user.id;

    if (user.role !== 'Admin') {
        const enrollment = await db.get('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [userId, courseId]);
        if (!enrollment) {
            return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
        }
    }

    // When a user views a lesson, create a progress entry if it doesn't exist.
    await db.run(
      `INSERT INTO user_progress (user_id, lesson_id, completed)
       VALUES (?, ?, 0)
       ON CONFLICT(user_id, lesson_id) DO NOTHING`,
      [userId, currentLessonId]
    );

    // Get current lesson data
    const lesson = await db.get(
        `SELECT 
            l.id, l.title, l.type, l.content, l.imagePath, l.documentPath,
            c.id as course_id, c.title as course_title,
            CASE WHEN up.completed = 1 THEN 1 ELSE 0 END as completed
         FROM lessons l
         JOIN modules m ON l.module_id = m.id
         JOIN courses c ON m.course_id = c.id
         LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = ?
         WHERE l.id = ?`,
        [userId, currentLessonId]
    );
    
    if (!lesson) {
        return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Get full course structure
    const courseData = await db.get('SELECT * FROM courses WHERE id = ?', courseId);
    if (!courseData) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    const modulesAndLessons = await db.all(
        `SELECT 
            m.id as module_id, 
            m.title as module_title, 
            m."order" as module_order,
            l.id as lesson_id, 
            l.title as lesson_title, 
            l.type as lesson_type, 
            CASE WHEN up.completed = 1 THEN 1 ELSE 0 END as completed
        FROM modules m
        LEFT JOIN lessons l ON m.id = l.module_id
        LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = ?
        WHERE m.course_id = ? 
        ORDER BY m."order" ASC, l."order" ASC`,
        [userId, courseId]
    );

    const modulesMap = new Map<number, any>();
    for (const row of modulesAndLessons) {
        if (!modulesMap.has(row.module_id)) {
            modulesMap.set(row.module_id, {
                id: row.module_id,
                title: row.module_title,
                lessons: []
            });
        }
        if (row.lesson_id) {
            modulesMap.get(row.module_id).lessons.push({
                id: row.lesson_id,
                title: row.lesson_title,
                type: row.lesson_type,
                completed: !!row.completed
            });
        }
    }
    const courseStructure = {
      id: courseData.id,
      title: courseData.title,
      modules: Array.from(modulesMap.values())
    };

    // Calculate progress and navigation
    const allCourseLessons = modulesAndLessons.filter(ml => ml.lesson_id);
    const totalLessons = allCourseLessons.length;
    const completedLessonsCount = allCourseLessons.filter(l => l.completed).length;
    const courseProgress = totalLessons > 0 ? Math.round((completedLessonsCount / totalLessons) * 100) : 0;
    
    const allLessonsOrderedIds = allCourseLessons.map(l => l.lesson_id);
    const currentLessonIndex = allLessonsOrderedIds.findIndex(l_id => l_id === currentLessonId);
    const previousLessonId = currentLessonIndex > 0 ? allLessonsOrderedIds[currentLessonIndex - 1] : null;
    const nextLessonId = currentLessonIndex < totalLessons - 1 ? allLessonsOrderedIds[currentLessonIndex + 1] : null;
    const hasFinalAssessment = !!courseData.final_assessment_content;
    
    // Assemble the final response
    const responseData = {
        lesson: {
            ...lesson,
            completed: !!lesson.completed,
        },
        course: courseStructure,
        progress: courseProgress,
        previousLessonId,
        nextLessonId,
        hasFinalAssessment,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch lesson data' }, { status: 500 })
  }
}
