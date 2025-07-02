
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'

// Helper to transform form quiz data to DB format
function transformQuestionsToDbFormat(questions: any[]) {
    return JSON.stringify(questions.map(q => ({
        text: q.text,
        options: q.options.map((opt: { text: string }, index: number) => ({
            text: opt.text,
            isCorrect: index === q.correctOptionIndex,
        })),
    })));
}

const quizOptionSchema = z.object({
  text: z.string(),
});

const quizQuestionSchema = z.object({
  text: z.string(),
  options: z.array(quizOptionSchema),
  correctOptionIndex: z.coerce.number(),
});

const lessonSchema = z.object({
  title: z.string(),
  type: z.enum(["video", "document", "quiz"]),
  content: z.string().optional().nullable(),
  imagePath: z.string().optional().nullable(),
  questions: z.array(quizQuestionSchema).optional(),
});

const moduleSchema = z.object({
  title: z.string(),
  lessons: z.array(lessonSchema),
});

const courseSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  imagePath: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  modules: z.array(moduleSchema),
}).refine(data => {
    if (data.startDate && data.endDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
}, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
});

export async function GET() {
  try {
    const db = await getDb()
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let courses;
    // Admins see all courses in the catalog.
    // Employees only see courses they have been enrolled in.
    if (user.role === 'Admin') {
        courses = await db.all('SELECT * FROM courses ORDER BY title ASC');
    } else {
        courses = await db.all(`
            SELECT c.* 
            FROM courses c
            JOIN enrollments e ON c.id = e.course_id
            WHERE e.user_id = ?
            ORDER BY c.title ASC
        `, [user.id]);
    }
    
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
    
    const { title, description, category, modules, imagePath, startDate, endDate } = parsedData.data;

    await db.run('BEGIN TRANSACTION');

    const courseResult = await db.run(
      'INSERT INTO courses (title, description, category, imagePath, startDate, endDate) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description, category, imagePath, startDate, endDate]
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
            let contentToStore = lessonData.content ?? null;
            if (lessonData.type === 'quiz' && lessonData.questions) {
                contentToStore = transformQuestionsToDbFormat(lessonData.questions);
            }

            await db.run(
                'INSERT INTO lessons (module_id, title, type, content, "order", imagePath) VALUES (?, ?, ?, ?, ?, ?)',
                [moduleId, lessonData.title, lessonData.type, contentToStore, lessonIndex + 1, lessonData.imagePath]
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
