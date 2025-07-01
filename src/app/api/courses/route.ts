import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { z } from 'zod'

const courseSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.string(),
  image: z.string().url().optional(),
  aiHint: z.string().optional(),
})

export async function GET() {
  try {
    const db = await getDb()
    const courses = await db.all('SELECT * FROM courses')
    return NextResponse.json(courses)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const parsedData = courseSchema.safeParse(data)

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsedData.error.errors }, { status: 400 })
    }
    
    const { title, description, category } = parsedData.data;
    const image = parsedData.data.image || 'https://placehold.co/600x400'
    const aiHint = parsedData.data.aiHint || 'education training'

    const db = await getDb()
    const result = await db.run(
      'INSERT INTO courses (title, description, category, image, aiHint) VALUES (?, ?, ?, ?, ?)',
      [title, description, category, image, aiHint]
    )

    if (!result.lastID) {
        throw new Error('Failed to insert course')
    }

    const newCourse = await db.get('SELECT * FROM courses WHERE id = ?', result.lastID)

    return NextResponse.json(newCourse, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 })
  }
}
