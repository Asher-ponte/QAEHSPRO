
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = await getDb()
    const courses = await db.all(`
      SELECT
        c.id,
        c.title,
        c.category,
        COUNT(DISTINCT m.id) as moduleCount,
        COUNT(DISTINCT l.id) as lessonCount
      FROM courses c
      LEFT JOIN modules m ON c.id = m.course_id
      LEFT JOIN lessons l ON m.id = l.module_id
      GROUP BY c.id
      ORDER BY c.title
    `)
    return NextResponse.json(courses)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch courses for admin' }, { status: 500 })
  }
}
