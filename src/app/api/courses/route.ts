import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { z } from 'zod'

const lessonSchema = z.object({
  title: z.string().min(3),
  type: z.enum(["video", "document", "quiz"]),
  content: z.string().optional(),
});

const moduleSchema = z.object({
  title: z.string().min(3),
  lessons: z.array(lessonSchema).min(1),
});

const courseSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.string(),
  modules: z.array(moduleSchema).min(1),
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
  const db = await getDb()
  try {
    const data = await request.json()
    const parsedData = courseSchema.safeParse(data)

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 })
    }
    
    const { title, description, category, modules } = parsedData.data;
    const image = parsedData.data.image || 'https://placehold.co/600x400'
    const aiHint = parsedData.data.aiHint || 'education training'

    await db.run('BEGIN TRANSACTION');

    // 1. Insert course
    const courseResult = await db.run(
      'INSERT INTO courses (title, description, category, image, aiHint) VALUES (?, ?, ?, ?, ?)',
      [title, description, category, image, aiHint]
    )
    const courseId = courseResult.lastID;
    if (!courseId) {
        throw new Error('Failed to create course');
    }

    // 2. Insert modules and lessons
    for (const [moduleIndex, moduleData] of modules.entries()) {
        const moduleResult = await db.run(
            'INSERT INTO modules (course_id, title, "order") VALUES (?, ?, ?)',
            [courseId, moduleData.title, moduleIndex + 1]
        );
        const moduleId = moduleResult.lastID;
        if (!moduleId) {
            throw new Error(`Failed to create module: ${moduleData.title}`);
        }

        for (const [lessonIndex, lessonData] of moduleData.lessons.entries()) {
            const lessonResult = await db.run(
                'INSERT INTO lessons (module_id, title, type, content, "order") VALUES (?, ?, ?, ?, ?)',
                [moduleId, lessonData.title, lessonData.type, lessonData.content ?? null, lessonIndex + 1]
            );
            if (!lessonResult.lastID) {
                throw new Error(`Failed to create lesson: ${lessonData.title}`);
            }
        }
    }
    
    await db.run('COMMIT');
    
    const newCourse = await db.get('SELECT * FROM courses WHERE id = ?', courseId)

    return NextResponse.json(newCourse, { status: 201 })
  } catch (error) {
    await db.run('ROLLBACK');
    console.error(error)
    return NextResponse.json({ error: 'Failed to create course', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
