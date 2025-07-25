
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

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

function transformDbToQuestionsFormat(content: string | null): any[] {
    if (!content) return [];
    try {
        const dbQuestions = JSON.parse(content);
        if (!Array.isArray(dbQuestions)) return [];
        
        return dbQuestions.map((q: any) => ({
            text: q.text,
            options: q.options.map((opt: any) => ({ text: opt.text })),
            correctOptionIndex: q.options.findIndex((opt: any) => opt.isCorrect),
        }));
    } catch (e) {
        console.error("Failed to parse DB questions format:", e);
        return [];
    }
}


const assessmentQuestionOptionSchema = z.object({
  id: z.number().optional(),
  text: z.string(),
});

const assessmentQuestionSchema = z.object({
  id: z.number().optional(),
  text: z.string(),
  options: z.array(assessmentQuestionOptionSchema),
  correctOptionIndex: z.coerce.number(),
});

const lessonSchema = z.object({
  id: z.number().optional(),
  title: z.string(),
  type: z.enum(["video", "document", "quiz"]),
  content: z.string().optional().nullable(),
  imagePath: z.string().optional().nullable(),
  documentPath: z.string().optional().nullable(),
  questions: z.array(assessmentQuestionSchema).optional(),
});

const moduleSchema = z.object({
  id: z.number().optional(),
  title: z.string(),
  lessons: z.array(lessonSchema),
});

const courseUpdateSchema = z.object({
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

  pre_test_questions: z.array(assessmentQuestionSchema).optional(),
  pre_test_passing_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  
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


export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const { user, siteId } = await getCurrentSession();
    if (user?.role !== 'Admin' || !siteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const db = await getDb();
        const { id: courseId } = params;

        if (!courseId) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        const [courseRows] = await db.query<RowDataPacket[]>('SELECT * FROM courses WHERE id = ? AND site_id = ?', [courseId, siteId]);
        const course = courseRows[0] as any;
        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        const [modulesAndLessons] = await db.query<any[]>(`
            SELECT 
                m.id as module_id, 
                m.title as module_title, 
                l.id as lesson_id,
                l.title as lesson_title,
                l.type as lesson_type,
                l.content as lesson_content,
                l.imagePath as lesson_imagePath,
                l.documentPath as lesson_documentPath
            FROM modules m
            LEFT JOIN lessons l ON m.id = l.module_id
            WHERE m.course_id = ?
            ORDER BY m.\`order\` ASC, l.\`order\` ASC
        `, [courseId]);
        
        const modulesMap = new Map<number, any>();
        for (const row of modulesAndLessons) {
             if (!modulesMap.has(row.module_id)) {
                modulesMap.set(row.module_id, {
                    id: row.module_id,
                    title: row.module_title,
                    lessons: []
                });
            }
            if (row.lesson_id) {
                const lesson: any = {
                    id: row.lesson_id,
                    title: row.lesson_title,
                    type: row.lesson_type,
                    imagePath: row.lesson_imagePath ?? null,
                    documentPath: row.lesson_documentPath ?? null,
                    content: row.lesson_content ?? null,
                };

                if (lesson.type === 'quiz') {
                    lesson.questions = transformDbToQuestionsFormat(lesson.content);
                }

                modulesMap.get(row.module_id).lessons.push(lesson);
            }
        }
        course.modules = Array.from(modulesMap.values());
        
        const [assignedSignatories] = await db.query<any[]>('SELECT signatory_id FROM course_signatories WHERE course_id = ?', [courseId]);
        const signatoryIds = assignedSignatories.map(s => s.signatory_id);
        
        const preTestQuestions = transformDbToQuestionsFormat(course.pre_test_content);
        const finalAssessmentQuestions = transformDbToQuestionsFormat(course.final_assessment_content);

        return NextResponse.json({
            ...course,
            is_internal: !!course.is_internal,
            is_public: !!course.is_public,
            imagePath: course.imagePath ?? null,
            venue: course.venue ?? null,
            signatoryIds,
            pre_test_questions: preTestQuestions,
            final_assessment_questions: finalAssessmentQuestions,
        });

    } catch (error) {
        console.error("Failed to fetch course for editing:", error);
        return NextResponse.json({ error: 'Failed to fetch course due to a server error' }, { status: 500 });
    }
}


export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { user, siteId } = await getCurrentSession();
    if (user?.role !== 'Admin' || !siteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    let db;
    try {
        const courseId = parseInt(params.id, 10);
        if (isNaN(courseId)) {
            return NextResponse.json({ error: 'Course ID must be a number' }, { status: 400 });
        }

        const data = await request.json();
        const parsedData = courseUpdateSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { 
            title, description, category, modules, imagePath, venue, startDate, endDate, 
            is_internal, is_public, price, signatoryIds, 
            pre_test_questions, pre_test_passing_rate,
            final_assessment_questions, final_assessment_passing_rate, final_assessment_max_attempts 
        } = parsedData.data;

        const preTestContent = (pre_test_questions && pre_test_questions.length > 0)
            ? transformQuestionsToDbFormat(pre_test_questions)
            : null;
        
        const finalAssessmentContent = (final_assessment_questions && final_assessment_questions.length > 0)
            ? transformQuestionsToDbFormat(final_assessment_questions)
            : null;

        db = await getDb();
        await db.query('START TRANSACTION');

        await db.query(
            `UPDATE courses SET 
                title = ?, description = ?, category = ?, imagePath = ?, venue = ?, startDate = ?, endDate = ?, 
                is_internal = ?, is_public = ?, price = ?, 
                pre_test_content = ?, pre_test_passing_rate = ?,
                final_assessment_content = ?, final_assessment_passing_rate = ?, final_assessment_max_attempts = ?
             WHERE id = ? AND site_id = ?`,
            [
                title, description, category, imagePath, venue, startDate, endDate, is_internal, is_public, price,
                preTestContent, pre_test_passing_rate,
                finalAssessmentContent, final_assessment_passing_rate, final_assessment_max_attempts,
                courseId, siteId
            ]
        );
        
        await db.query('DELETE FROM course_signatories WHERE course_id = ?', [courseId]);
        if (signatoryIds && signatoryIds.length > 0) {
            for (const signatoryId of signatoryIds) { 
                await db.query('INSERT INTO course_signatories (course_id, signatory_id) VALUES (?, ?)', [courseId, signatoryId]);
            }
        }

        const [existingModuleRows] = await db.query<any[]>('SELECT id FROM modules WHERE course_id = ?', [courseId]);
        const existingModuleIds = new Set(existingModuleRows.map(m => m.id));
        const payloadModuleIds = new Set(modules.filter(m => m.id).map(m => m.id as number));
        for (const existingId of existingModuleIds) {
            if (!payloadModuleIds.has(existingId)) { 
                await db.query('DELETE FROM lessons WHERE module_id = ?', [existingId]);
                await db.query('DELETE FROM modules WHERE id = ?', [existingId]); 
            }
        }

        for (const [moduleIndex, moduleData] of modules.entries()) {
            let moduleId = moduleData.id;
            if (moduleId && existingModuleIds.has(moduleId)) {
                await db.query('UPDATE modules SET title = ?, `order` = ? WHERE id = ?', [moduleData.title, moduleIndex + 1, moduleId]);
            } else {
                const [moduleResult] = await db.query<ResultSetHeader>('INSERT INTO modules (course_id, title, `order`) VALUES (?, ?, ?)', [courseId, moduleData.title, moduleIndex + 1]);
                moduleId = moduleResult.insertId;
                if (!moduleId) throw new Error(`Failed to create module: ${moduleData.title}`);
            }

            const [existingLessonRows] = await db.query<any[]>('SELECT id FROM lessons WHERE module_id = ?', [moduleId]);
            const existingLessonIds = new Set(existingLessonRows.map(l => l.id));
            const payloadLessonIds = new Set(moduleData.lessons.filter(l => l.id).map(l => l.id as number));
            for (const existingId of existingLessonIds) {
                if (!payloadLessonIds.has(existingId)) { await db.query('DELETE FROM lessons WHERE id = ?', [existingId]); }
            }

            for (const [lessonIndex, lessonData] of moduleData.lessons.entries()) {
                const lessonContent = lessonData.type === 'quiz'
                    ? transformQuestionsToDbFormat(lessonData.questions || [])
                    : lessonData.content ?? null;

                if (lessonData.id && existingLessonIds.has(lessonData.id)) {
                     await db.query('UPDATE lessons SET title = ?, type = ?, content = ?, `order` = ?, imagePath = ?, documentPath = ? WHERE id = ?', [lessonData.title, lessonData.type, lessonContent, lessonIndex + 1, lessonData.imagePath, lessonData.documentPath, lessonData.id]);
                } else {
                    await db.query('INSERT INTO lessons (module_id, title, type, content, `order`, imagePath, documentPath) VALUES (?, ?, ?, ?, ?, ?, ?)', [moduleId, lessonData.title, lessonData.type, lessonContent, lessonIndex + 1, lessonData.imagePath, lessonData.documentPath]);
                }
            }
        }
        await db.query('COMMIT');
       
        const [updatedCourseRows] = await db.query<any[]>('SELECT * FROM courses WHERE id = ?', [courseId]);
        return NextResponse.json(updatedCourseRows[0], { status: 200 });

    } catch (error) {
        if (db) {
            await db.query('ROLLBACK').catch(console.error);
        }
        console.error("Failed to update course:", error);
        return NextResponse.json({ error: 'Failed to update course due to a server error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}


export async function DELETE(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (user?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let db;
    try {
        db = await getDb();
        const { id: courseId } = params;

        if (!courseId) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }
        
        let targetSiteId = sessionSiteId;
        
        if (isSuperAdmin) {
            const [courseToDeleteRows] = await db.query<RowDataPacket[]>('SELECT site_id FROM courses WHERE id = ?', [courseId]);
            if (courseToDeleteRows.length === 0) {
                return NextResponse.json({ error: 'Course not found anywhere.' }, { status: 404 });
            }
            targetSiteId = courseToDeleteRows[0].site_id;
        }
        
        await db.query('START TRANSACTION');
        
        const [moduleRows] = await db.query<any[]>('SELECT id FROM modules WHERE course_id = ?', [courseId]);
        const moduleIds = moduleRows.map(m => m.id);

        if (moduleIds.length > 0) {
            const [lessonRows] = await db.query<any[]>(`SELECT id FROM lessons WHERE module_id IN (?)`, [moduleIds]);
            const lessonIds = lessonRows.map(l => l.id);

            if (lessonIds.length > 0) {
                await db.query(`DELETE FROM user_progress WHERE lesson_id IN (?)`, [lessonIds]);
            }
            
            await db.query(`DELETE FROM lessons WHERE module_id IN (?)`, [moduleIds]);
        }
        
        await db.query('DELETE FROM modules WHERE course_id = ?', [courseId]);
        
        const [result] = await db.query<ResultSetHeader>('DELETE FROM courses WHERE id = ? AND site_id = ?', [courseId, targetSiteId]);

        if (result.affectedRows === 0) {
             await db.query('ROLLBACK');
             return NextResponse.json({ error: 'Course not found or already deleted' }, { status: 404 });
        }
        
        await db.query('COMMIT');

        return NextResponse.json({ success: true, message: `Course ${courseId} deleted successfully.` });

    } catch (error) {
        if (db) {
            await db.query('ROLLBACK').catch(console.error);
        }
        console.error("Failed to delete course:", error);
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: 'Failed to delete course due to a server error.', details }, { status: 500 });
    }
}
