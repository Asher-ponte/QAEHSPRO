import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string; lessonId: string } }
) {
  try {
    const db = await getDb()
    const { lessonId } = params

    const lesson = await db.get(
        `SELECT l.id, l.title, l.type, l.content, m.id as module_id, m.title as module_title, c.id as course_id, c.title as course_title
         FROM lessons l
         JOIN modules m ON l.module_id = m.id
         JOIN courses c ON m.course_id = c.id
         WHERE l.id = ?`,
        lessonId
    )
    
    if (!lesson) {
        return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    return NextResponse.json(lesson)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch lesson' }, { status: 500 })
  }
}
