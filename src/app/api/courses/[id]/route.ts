import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb()
    const course = await db.get('SELECT * FROM courses WHERE id = ?', params.id)
    
    if (!course) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const modules = await db.all(
        `SELECT id, title FROM modules WHERE course_id = ? ORDER BY "order" ASC`,
        params.id
    );

    const courseDetail = { ...course, modules: [] as any[] };

    for (const module of modules) {
        // For now, we'll mock the user ID as 1 (for 'johndoe').
        // In a real app, you'd get this from the user's session.
        const lessons = await db.all(
            `SELECT 
                l.id, 
                l.title, 
                l.type, 
                CASE WHEN up.completed = 1 THEN 1 ELSE 0 END as completed
             FROM lessons l
             LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = 1
             WHERE l.module_id = ? 
             ORDER BY l."order" ASC`,
            module.id
        );
        courseDetail.modules.push({ ...module, lessons });
    }

    // If a course has no modules, provide some default placeholder data.
    if (courseDetail.modules.length === 0) {
      courseDetail.modules.push({
          title: "Module 1: Coming Soon",
          lessons: [
            { title: "Course content is being prepared.", type: "document", completed: false },
          ],
        },)
    }


    return NextResponse.json(courseDetail)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 })
  }
}
