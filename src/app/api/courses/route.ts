
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { z } from 'zod'
import { getCurrentSession } from '@/lib/session'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

// Helper to transform form quiz data to DB format
function transformQuestionsToDbFormat(questions: any[]) {
    if (!questions || !Array.isArray(questions)) return null;
    return JSON.stringify(questions.map(q => ({
        text: q.text,
        options: q.options.map((opt: { text: string }, index: number) => ({
            text: opt.text,
            isCorrect: index === q.correctOptionIndex,
        })),
    })));
}

const assessmentQuestionOptionSchema = z.object({
  text: z.string(),
});

const assessmentQuestionSchema = z.object({
  text: z.string(),
  options: z.array(assessmentQuestionOptionSchema).min(2, "Must have at least two options."),
  correctOptionIndex: z.coerce.number().min(0, "A correct option must be selected."),
});

const lessonSchema = z.object({
  title: z.string(),
  type: z.enum(["video", "document", "quiz"]),
  content: z.string().optional().nullable(),
  imagePath: z.string().optional().nullable(),
  documentPath: z.string().optional().nullable(),
  questions: z.array(assessmentQuestionSchema).optional(),
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
  
  final_assessment_questions: z.array(assessmentQuestionSchema).optional(),
  final_assessment_passing_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  final_assessment_max_attempts: z.coerce.number().min(1).optional().nullable(),
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
}).refine(data => {
    if ((data.final_assessment_questions?.length ?? 0) > 0) {
        return data.final_assessment_passing_rate !== null && data.final_assessment_passing_rate !== undefined && data.final_assessment_max_attempts !== null && data.final_assessment_max_attempts !== undefined;
    }
    return true;
}, {
    message: "Passing Rate and Max Attempts are required when there are assessment questions.",
    path: ["final_assessment_passing_rate"],
});

export async function GET() {
  const { user, siteId } = await getCurrentSession();
  if (!user || !siteId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const db = await getDb();

    let courses;
    if (user.type === 'External') {
        // External users should see all public courses from all sites.
        const [rows] = await db.query<RowDataPacket[]>(`
            SELECT * FROM courses WHERE is_public = 1 ORDER BY title ASC
        `);
        courses = rows;
    } else { // Employee or Admin
        // Internal users only see courses from their assigned site.
        const [rows] = await db.query<RowDataPacket[]>(`
            SELECT id, title, description, category, imagePath, startDate, endDate, is_public, is_internal,
                   NULL as price
            FROM courses 
            WHERE (is_internal = 1 OR is_public = 1) AND site_id = ?
            ORDER BY title ASC
        `, [siteId]);
        courses = rows;
    }
    
    return NextResponse.json(courses)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
  }
}

const createCourseInDb = async (db: any, payload: z.infer<typeof courseSchema>, siteIdForCourse: string, siteIdForSignatories: string) => {
    await db.query('START TRANSACTION');
    try {
        const coursePriceForThisBranch = siteIdForCourse === 'external' ? payload.price : null;

        const finalAssessmentContent = (payload.final_assessment_questions && payload.final_assessment_questions.length > 0) 
            ? transformQuestionsToDbFormat(payload.final_assessment_questions) 
            : null;

        const [courseResult] = await db.query<ResultSetHeader>(
            `INSERT INTO courses (
                site_id, title, description, category, imagePath, venue, startDate, endDate, 
                is_internal, is_public, price, 
                final_assessment_content, final_assessment_passing_rate, final_assessment_max_attempts
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                siteIdForCourse, payload.title, payload.description, payload.category, payload.imagePath, 
                payload.venue, payload.startDate, payload.endDate, payload.is_internal, payload.is_public, 
                coursePriceForThisBranch, 
                finalAssessmentContent, payload.final_assessment_passing_rate, payload.final_assessment_max_attempts
            ]
        );
        const courseId = courseResult.insertId;
        if (!courseId) throw new Error('Failed to create course');
        
        const signatoryIds = payload.branchSignatories[siteIdForSignatories] || [];
        if (signatoryIds.length > 0) {
            for (const signatoryId of signatoryIds) {
                await db.query('INSERT INTO course_signatories (course_id, signatory_id) VALUES (?, ?)', [courseId, signatoryId]);
            }
        }

        for (const [moduleIndex, moduleData] of payload.modules.entries()) {
            const [moduleResult] = await db.query<ResultSetHeader>('INSERT INTO modules (course_id, title, \`order\`) VALUES (?, ?, ?)', [courseId, moduleData.title, moduleIndex + 1]);
            const moduleId = moduleResult.insertId;
            if (!moduleId) throw new Error(`Failed to create module: ${moduleData.title}`);

            for (const [lessonIndex, lessonData] of moduleData.lessons.entries()) {
                 const lessonContent = lessonData.type === 'quiz' && lessonData.questions
                    ? transformQuestionsToDbFormat(lessonData.questions)
                    : lessonData.content ?? null;

                await db.query('INSERT INTO lessons (module_id, title, type, content, \`order\`, imagePath, documentPath) VALUES (?, ?, ?, ?, ?, ?, ?)', [moduleId, lessonData.title, lessonData.type, lessonContent, lessonIndex + 1, lessonData.imagePath, lessonData.documentPath]);
            }
        }
        await db.query('COMMIT');
    } catch (e) {
        await db.query('ROLLBACK');
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

    const db = await getDb();

    if (!isSuperAdmin) {
        try {
            await createCourseInDb(db, coursePayload, sessionSiteId, sessionSiteId);
            return NextResponse.json({ success: true, message: 'Course created.' }, { status: 201 });
        } catch (error) {
            console.error(`Course creation failed for client admin in site '${sessionSiteId}':`, error);
            return NextResponse.json({ error: 'Failed to create course.', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
        }
    }

    try {
        await createCourseInDb(db, coursePayload, 'main', 'main');
    } catch (error) {
        console.error("CRITICAL: Failed to create master course in 'main' branch:", error);
        return NextResponse.json({ error: 'Failed to create the master course.', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }

    const targetSiteIds = coursePayload.targetSiteIds || [];
    const replicationErrors = [];

    const effectiveTargetSites = new Set(targetSiteIds);
    if (coursePayload.is_public) {
        effectiveTargetSites.add('external');
    }

    for (const targetSiteId of effectiveTargetSites) {
        if (targetSiteId === 'main') continue;
        try {
            await createCourseInDb(db, coursePayload, targetSiteId, 'main');
        } catch (error) {
            const errorMessage = `Failed to create course copy in branch '${targetSiteId}': ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMessage);
            replicationErrors.push(errorMessage);
        }
    }
    
    if (replicationErrors.length > 0) {
        return NextResponse.json({
            success: true,
            message: 'Master course created, but failed to publish to some other branches.',
            details: replicationErrors.join('\n')
        }, { status: 207 });
    }

    return NextResponse.json({ success: true, message: `Course created in main branch and published to ${effectiveTargetSites.size} other branch(es).` }, { status: 201 });
}
