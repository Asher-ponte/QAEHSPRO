
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/session';

export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string; lessonId: string } }
) {
  try {
    const db = await getDb()
    const { id: courseId, lessonId } = params
    
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const userId = user.id;

    // Admins can view any content. Employees must be enrolled.
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
      [userId, lessonId]
    );

    const lesson = await db.get(
        `SELECT 
            l.id, l.title, l.type, l.content, l.imagePath,
            m.id as module_id, m.title as module_title, 
            c.id as course_id, c.title as course_title,
            CASE WHEN up.completed = 1 THEN 1 ELSE 0 END as completed
         FROM lessons l
         JOIN modules m ON l.module_id = m.id
         JOIN courses c ON m.course_id = c.id
         LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = ?
         WHERE l.id = ?`,
        [userId, lessonId]
    )
    
    if (!lesson) {
        return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    // Ensure `completed` is a boolean
    const lessonWithBoolean = {
        ...lesson,
        completed: !!lesson.completed
    }

    return NextResponse.json(lessonWithBoolean)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch lesson' }, { status: 500 })
  }
}

