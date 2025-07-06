

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { z } from 'zod'
import { getCurrentSession } from '@/lib/session'

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
  venue: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  is_internal: z.boolean().default(true),
  is_public: z.boolean().default(false),
  price: z.coerce.number().optional().nullable(),
  modules: z.array(moduleSchema),
  signatoryIds: z.array(z.number()).default([]),
}).refine(data => {
    if (data.startDate && data.endDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
}, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
}).refine(data => {
    if (data.is_public && (data.price === null || data.price === undefined || data.price < 0)) {
        return false;
    }
    return true;
}, {
    message: "Price must be a positive number for public courses.",
    path: ["price"],
}).refine(data => {
    return data.is_internal || data.is_public;
}, {
    message: "A course must be available to at least one audience (Internal or Public).",
    path: ["is_public"], 
});

export async function GET() {
  const { user, siteId } = await getCurrentSession();
  if (!user || !siteId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const db = await getDb(siteId);

    let courses;
    // Admins and Employees see all internal courses, plus all public courses.
    // External users see only public courses.
    if (user.role === 'Admin' || user.type === 'Employee') {
        courses = await db.all(`
            SELECT * FROM courses 
            WHERE is_internal = 1 OR is_public = 1
            ORDER BY title ASC
        `);
    } else { // External user
         courses = await db.all(`
            SELECT * FROM courses WHERE is_public = 1 ORDER BY title ASC
        `);
    }
    
    return NextResponse.json(courses)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, siteId } = await getCurrentSession();
  if (user?.role !== 'Admin' || !siteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const db = await getDb(siteId);

  try {
    const data = await request.json()
    const parsedData = courseSchema.safeParse(data)

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 })
    }
    
    const { title, description, category, modules, imagePath, venue, startDate, endDate, is_internal, is_public, price, signatoryIds } = parsedData.data;

    await db.run('BEGIN TRANSACTION');

    const courseResult = await db.run(
      'INSERT INTO courses (title, description, category, imagePath, venue, startDate, endDate, is_internal, is_public, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description, category, imagePath, venue, startDate, endDate, is_internal, is_public, price]
    )
    const courseId = courseResult.lastID;
    if (!courseId) {
        throw new Error('Failed to create course');
    }

    // Assign signatories
    if (signatoryIds && signatoryIds.length > 0) {
        const stmt = await db.prepare('INSERT INTO course_signatories (course_id, signatory_id) VALUES (?, ?)');
        for (const signatoryId of signatoryIds) {
            await stmt.run(courseId, signatoryId);
        }
        await stmt.finalize();
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
