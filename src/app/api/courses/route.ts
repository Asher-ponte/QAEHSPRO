

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
  targetSiteIds: z.array(z.string()).optional(),
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
    // If user is external, fetch public courses from 'main' site.
    // Otherwise, fetch courses from the user's own site.
    const courseDbSiteId = user.type === 'External' ? 'main' : siteId;
    const db = await getDb(courseDbSiteId);

    let courses;
    // Admins and Employees see courses available on their site.
    // External users see only public courses from the MAIN site.
    if (user.type === 'External') {
         courses = await db.all(`
            SELECT * FROM courses WHERE is_public = 1 ORDER BY title ASC
        `);
    } else { // Employee or Admin
        courses = await db.all(`
            SELECT id, title, description, category, imagePath, startDate, endDate, is_public, is_internal,
                   NULL as price  -- Explicitly nullify price for branch users
            FROM courses 
            WHERE is_internal = 1 OR is_public = 1
            ORDER BY title ASC
        `);
    }
    
    return NextResponse.json(courses)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
  if (user?.role !== 'Admin' || !sessionSiteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    const data = await request.json()
    const parsedData = courseSchema.safeParse(data)

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 })
    }
    
    const { title, description, category, modules, imagePath, venue, startDate, endDate, is_internal, is_public, price, signatoryIds, targetSiteIds } = parsedData.data;

    const effectivePrice = (isSuperAdmin && targetSiteIds?.includes('external')) || (!isSuperAdmin && sessionSiteId === 'external') ? price : null;

    // Use selected sites for super admin, or session site for client admin
    const sitesToCreateIn = isSuperAdmin ? (targetSiteIds || []) : [sessionSiteId];
    if (sitesToCreateIn.length === 0) {
        return NextResponse.json({ error: 'Super admins must select at least one branch.' }, { status: 400 });
    }

    // This block will execute the creation logic for each selected branch.
    for (const targetSiteId of sitesToCreateIn) {
        const db = await getDb(targetSiteId);
        await db.run('BEGIN TRANSACTION');
        try {
            const coursePriceForThisBranch = targetSiteId === 'external' ? price : null;
            const courseResult = await db.run(
              'INSERT INTO courses (title, description, category, imagePath, venue, startDate, endDate, is_internal, is_public, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [title, description, category, imagePath, venue, startDate, endDate, is_internal, is_public, coursePriceForThisBranch]
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
        } catch (innerError) {
            await db.run('ROLLBACK');
            // Re-throw to be caught by the outer catch block, ensuring the loop stops.
            throw new Error(`Failed to create course in branch '${targetSiteId}': ${innerError instanceof Error ? innerError.message : String(innerError)}`);
        }
    }

    return NextResponse.json({ success: true, message: `Course created in ${sitesToCreateIn.length} branch(es).` }, { status: 201 });

  } catch (error) {
    console.error("Course creation process failed:", error)
    return NextResponse.json({ error: 'Failed to create course in one or more branches.', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
