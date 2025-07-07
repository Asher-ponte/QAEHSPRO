

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
  documentPath: z.string().optional().nullable(),
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
  branchSignatories: z.record(z.string(), z.array(z.number()).default([])).default({}),
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
    const db = await getDb(siteId);

    let courses;
    if (user.type === 'External') {
        // External users see only public courses from their branch database.
         courses = await db.all(`
            SELECT * FROM courses WHERE is_public = 1 ORDER BY title ASC
        `);
    } else { // Employee or Admin
        // Branch users see all internal or public courses from their branch's database.
        // Price is explicitly nulled to ensure they don't see payment options.
        courses = await db.all(`
            SELECT id, title, description, category, imagePath, startDate, endDate, is_public, is_internal,
                   NULL as price
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

// Helper function to contain the course creation logic for a single DB.
const createCourseInDb = async (db: any, payload: z.infer<typeof courseSchema>, siteIdForSignatories: string, siteIdForPricing: string) => {
    await db.run('BEGIN TRANSACTION');
    try {
        const coursePriceForThisBranch = siteIdForPricing === 'external' ? payload.price : null;
        const courseResult = await db.run(
            'INSERT INTO courses (title, description, category, imagePath, venue, startDate, endDate, is_internal, is_public, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [payload.title, payload.description, payload.category, payload.imagePath, payload.venue, payload.startDate, payload.endDate, payload.is_internal, payload.is_public, coursePriceForThisBranch]
        );
        const courseId = courseResult.lastID;
        if (!courseId) throw new Error('Failed to create course');
        
        const signatoryIds = payload.branchSignatories[siteIdForSignatories] || [];
        if (signatoryIds.length > 0) {
            const stmt = await db.prepare('INSERT INTO course_signatories (course_id, signatory_id) VALUES (?, ?)');
            for (const signatoryId of signatoryIds) {
                await stmt.run(courseId, signatoryId);
            }
            await stmt.finalize();
        }

        for (const [moduleIndex, moduleData] of payload.modules.entries()) {
            const moduleResult = await db.run('INSERT INTO modules (course_id, title, "order") VALUES (?, ?, ?)', [courseId, moduleData.title, moduleIndex + 1]);
            const moduleId = moduleResult.lastID;
            if (!moduleId) throw new Error(`Failed to create module: ${moduleData.title}`);

            for (const [lessonIndex, lessonData] of moduleData.lessons.entries()) {
                let contentToStore = lessonData.content ?? null;
                if (lessonData.type === 'quiz' && lessonData.questions) {
                    contentToStore = transformQuestionsToDbFormat(lessonData.questions);
                }
                await db.run('INSERT INTO lessons (module_id, title, type, content, "order", imagePath, documentPath) VALUES (?, ?, ?, ?, ?, ?, ?)', [moduleId, lessonData.title, lessonData.type, contentToStore, lessonIndex + 1, lessonData.imagePath, lessonData.documentPath]);
            }
        }
        await db.run('COMMIT');
    } catch (e) {
        await db.run('ROLLBACK');
        throw e; // rethrow
    }
};

export async function POST(request: NextRequest) {
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (user?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await request.json();
    const parsedData = courseSchema.safeParse(data);

    if (!parsedData.success) {
        return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
    }

    const coursePayload = parsedData.data;

    // --- Client Admin Logic ---
    if (!isSuperAdmin) {
        try {
            const db = await getDb(sessionSiteId);
            // For a client admin, there is only one site context.
            await createCourseInDb(db, coursePayload, 'default', sessionSiteId);
            return NextResponse.json({ success: true, message: 'Course created.' }, { status: 201 });
        } catch (error) {
            console.error(`Course creation failed for client admin in site '${sessionSiteId}':`, error);
            return NextResponse.json({ error: 'Failed to create course.', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
        }
    }

    // --- Super Admin Logic ---
    
    // Step 1: Create in Main Branch. This is the critical master copy.
    try {
        const mainDb = await getDb('main');
        await createCourseInDb(mainDb, coursePayload, 'main', 'main');
    } catch (error) {
        console.error("CRITICAL: Failed to create master course in 'main' branch:", error);
        return NextResponse.json({ error: 'Failed to create the master course.', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }

    // Step 2: Replicate to other selected branches.
    const targetSiteIds = coursePayload.targetSiteIds || [];
    const replicationErrors = [];

    for (const targetSiteId of targetSiteIds) {
        if (targetSiteId === 'main') continue;
        try {
            const targetDb = await getDb(targetSiteId);
            await createCourseInDb(targetDb, coursePayload, targetSiteId, targetSiteId);
        } catch (error) {
            const errorMessage = `Failed to create course copy in branch '${targetSiteId}': ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMessage);
            replicationErrors.push(errorMessage);
        }
    }
    
    // Step 3: Respond to the client with the outcome.
    if (replicationErrors.length > 0) {
        return NextResponse.json({
            success: true, // Master course was created, so overall action is a partial success.
            message: 'Master course created, but failed to publish to some other branches.',
            details: replicationErrors.join('\n')
        }, { status: 207 }); // 207 Multi-Status
    }

    return NextResponse.json({ success: true, message: `Course created in main branch and published to ${targetSiteIds.length} other branch(es).` }, { status: 201 });
}
