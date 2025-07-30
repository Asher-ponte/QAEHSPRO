

'use server'

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string; lessonId: string } }
) {
  const { user, siteId } = await getCurrentSession();
  if (!user || !siteId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const db = await getDb();
    const { id: courseIdStr, lessonId: currentLessonIdStr } = params;
    const currentLessonId = parseInt(currentLessonIdStr, 10);
    const courseId = parseInt(courseIdStr, 10);
    
    const userId = user.id;
    
    if (isNaN(courseId) || isNaN(currentLessonId)) {
        return NextResponse.json({ error: 'Invalid course or lesson ID.' }, { status: 400 });
    }

    // --- ACCESS CONTROL ---
    if (user.role !== 'Admin') {
        let hasAccess = false;
        // 1. Check for direct enrollment
        const [enrollmentRows] = await db.query<RowDataPacket[]>('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [userId, courseId]);
        if (enrollmentRows.length > 0) hasAccess = true;

        // 2. For external users, also check if they have a valid transaction
        if (!hasAccess && user.type === 'External') {
            const [transactionRows] = await db.query<RowDataPacket[]>(
                `SELECT id FROM transactions WHERE user_id = ? AND course_id = ? AND status IN ('pending', 'completed')`,
                [userId, courseId]
            );
            if (transactionRows.length > 0) hasAccess = true;
        }

        if (!hasAccess) {
             return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
        }
    }
    // --- END ACCESS CONTROL ---

    await db.query(
      'INSERT IGNORE INTO user_progress (user_id, lesson_id, completed) VALUES (?, ?, 0)',
      [userId, currentLessonId]
    );

    // Get current lesson data
    const [lessonRows] = await db.query<RowDataPacket[]>(
        `SELECT 
            l.id, l.title, l.type, l.content, l.imagePath, l.documentPath,
            c.id as course_id, c.title as course_title,
            (SELECT COUNT(*) > 0 FROM user_progress up WHERE up.lesson_id = l.id AND up.user_id = ? AND up.completed = 1) as completed
         FROM lessons l
         JOIN modules m ON l.module_id = m.id
         JOIN courses c ON m.course_id = c.id
         WHERE l.id = ? AND c.site_id = ?`,
        [userId, currentLessonId, siteId]
    );
    const lesson = lessonRows[0];
    
    if (!lesson) {
        return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Get full course structure
    const [courseRows] = await db.query<RowDataPacket[]>('SELECT * FROM courses WHERE id = ?', [courseId]);
    const courseData = courseRows[0];

    if (!courseData) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    const [modulesAndLessons] = await db.query<RowDataPacket[]>(
        `SELECT 
            m.id as module_id, 
            m.title as module_title, 
            m.order as module_order,
            l.id as lesson_id, 
            l.title as lesson_title, 
            l.type as lesson_type, 
            (SELECT COUNT(*) > 0 FROM user_progress up WHERE up.lesson_id = l.id AND up.user_id = ? AND up.completed = 1) as completed
        FROM modules m
        LEFT JOIN lessons l ON m.id = l.module_id
        WHERE m.course_id = ? 
        ORDER BY m.order ASC, l.order ASC`,
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
    const allLessonsCompleted = totalLessons > 0 && completedLessonsCount >= totalLessons;
    
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
        allLessonsCompleted,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch lesson data' }, { status: 500 })
  }
}
