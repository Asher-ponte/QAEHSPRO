import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb()
    const course = await db.get('SELECT * FROM courses WHERE id = ?', params.id)
    
    if (!course) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    // Mimic existing data structure with static modules for now.
    const courseDetail = {
      ...course,
      modules: [
        {
          title: "Module 1: Introduction",
          lessons: [
            { title: "Welcome to the Course", type: "video", completed: true },
            { title: "Core Concepts", type: "video", completed: false },
            { title: "Reading: Getting Started", type: "document", completed: false },
          ],
        },
        {
          title: "Module 2: Deep Dive",
          lessons: [
            { title: "Advanced Topics", type: "video", completed: false },
            { title: "Practical Application", type: "video", completed: false },
          ],
        },
        {
          title: "Module 3: Conclusion",
          lessons: [
            { title: "Summary and Review", type: "video", completed: false },
            { title: "Course Quiz", type: "quiz", completed: false },
          ],
        },
      ]
    }

    return NextResponse.json(courseDetail)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 })
  }
}
