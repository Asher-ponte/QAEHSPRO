
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = await getDb()
    const coursesData = await db.all(`
      SELECT
        c.id,
        c.title,
        c.category,
        c.startDate,
        c.endDate,
        COUNT(DISTINCT m.id) as moduleCount,
        COUNT(DISTINCT l.id) as lessonCount,
        COUNT(DISTINCT e.user_id) as enrolledCount,
        (SELECT COUNT(DISTINCT cert.user_id) FROM certificates cert WHERE cert.course_id = c.id) as completedCount
      FROM courses c
      LEFT JOIN modules m ON c.id = m.course_id
      LEFT JOIN lessons l ON m.id = l.module_id
      LEFT JOIN enrollments e ON c.id = e.course_id
      GROUP BY c.id
      ORDER BY c.title
    `)

    const courses = coursesData.map(course => {
        const { enrolledCount, completedCount } = course;
        const completionRate = enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0;
        return {
            ...course,
            completionRate
        }
    });

    return NextResponse.json(courses)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch courses for admin' }, { status: 500 })
  }
}
