
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { z } from 'zod'

const quizQuestionSchema = z.object({
  text: z.string().min(1),
  options: z.array(z.object({
      text: z.string().min(1),
      isCorrect: z.boolean(),
  })).min(2).refine(
      (options) => options.filter(opt => opt.isCorrect).length === 1,
      { message: "Each question must have exactly one correct option." }
  ),
});

const quizSchema = z.array(quizQuestionSchema).min(1);

const lessonSchema = z.object({
  title: z.string().min(3),
  type: z.enum(["video", "document", "quiz"]),
  content: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'document' && (!data.content || data.content.trim().length < 10)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Document content must be at least 10 characters.", path: ['content'] });
    }
    if (data.type === 'quiz') {
        if (!data.content) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Quiz content is required.", path: ['content'] });
            return;
        }
        try {
            const parsedContent = JSON.parse(data.content);
            if (!quizSchema.safeParse(parsedContent).success) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid quiz JSON structure.", path: ['content'] });
            }
        } catch (error) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid JSON format.", path: ['content'] });
        }
    }
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
  image: z.string().url().optional().or(z.literal('')),
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

    const courseResult = await db.run(
      'INSERT INTO courses (title, description, category, image, aiHint) VALUES (?, ?, ?, ?, ?)',
      [title, description, category, image, aiHint]
    )
    const courseId = courseResult.lastID;
    if (!courseId) {
        throw new Error('Failed to create course');
    }

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
            await db.run(
                'INSERT INTO lessons (module_id, title, type, content, "order") VALUES (?, ?, ?, ?, ?)',
                [moduleId, lessonData.title, lessonData.type, lessonData.content ?? null, lessonIndex + 1]
            );
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
