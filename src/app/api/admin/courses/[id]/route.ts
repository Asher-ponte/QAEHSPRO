

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';

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

// Helper to transform DB quiz data to form format
function transformDbToQuestionsFormat(content: string | null) {
    if (!content) return [];
    try {
        const dbQuestions = JSON.parse(content);
        return dbQuestions.map((q: any) => ({
            text: q.text,
            options: q.options.map((opt: any) => ({ text: opt.text })),
            correctOptionIndex: q.options.findIndex((opt: any) => opt.isCorrect),
        }));
    } catch (e) {
        return []; // Return empty array if JSON is invalid
    }
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
  id: z.number().optional(),
  title: z.string(),
  type: z.enum(["video", "document", "quiz"]),
  content: z.string().optional().nullable(),
  imagePath: z.string().optional().nullable(),
  questions: z.array(quizQuestionSchema).optional(),
});

const moduleSchema = z.object({
  id: z.number().optional(),
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


export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const { user, siteId } = await getCurrentSession();
    if (user?.role !== 'Admin' || !siteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const db = await getDb(siteId);
        const { id: courseId } = params;

        if (!courseId) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        const course = await db.get('SELECT * FROM courses WHERE id = ?', courseId);
        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        const modulesAndLessons = await db.all(`
            SELECT 
                m.id as module_id, 
                m.title as module_title, 
                l.id as lesson_id,
                l.title as lesson_title,
                l.type as lesson_type,
                l.content as lesson_content,
                l.imagePath as lesson_imagePath
            FROM modules m
            LEFT JOIN lessons l ON m.id = l.module_id
            WHERE m.course_id = ?
            ORDER BY m."order" ASC, l."order" ASC
        `, courseId);
        
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
                };

                if (row.lesson_type === 'quiz') {
                    lesson.questions = transformDbToQuestionsFormat(row.lesson_content);
                    lesson.content = null;
                } else {
                    lesson.content = row.lesson_content ?? null;
                }
                modulesMap.get(row.module_id).lessons.push(lesson);
            }
        }
        course.modules = Array.from(modulesMap.values());
        
        const assignedSignatories = await db.all('SELECT signatory_id FROM course_signatories WHERE course_id = ?', courseId);
        const signatoryIds = assignedSignatories.map(s => s.signatory_id);

        return NextResponse.json({
            ...course,
            is_internal: !!course.is_internal,
            is_public: !!course.is_public,
            imagePath: course.imagePath ?? null,
            venue: course.venue ?? null,
            signatoryIds,
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
        db = await getDb(siteId);
        const { id: courseId } = params;

        if (!courseId) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        const data = await request.json();
        const parsedData = courseSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { title, description, category, modules, imagePath, venue, startDate, endDate, is_internal, is_public, price, signatoryIds } = parsedData.data;

        await db.run('BEGIN TRANSACTION');

        // 1. Update the course itself
        await db.run(
            'UPDATE courses SET title = ?, description = ?, category = ?, imagePath = ?, venue = ?, startDate = ?, endDate = ?, is_internal = ?, is_public = ?, price = ? WHERE id = ?',
            [title, description, category, imagePath, venue, startDate, endDate, is_internal, is_public, price, courseId]
        );

        // 2. Update signatories
        await db.run('DELETE FROM course_signatories WHERE course_id = ?', courseId);
        if (signatoryIds && signatoryIds.length > 0) {
            const stmt = await db.prepare('INSERT INTO course_signatories (course_id, signatory_id) VALUES (?, ?)');
            for (const signatoryId of signatoryIds) {
                await stmt.run(courseId, signatoryId);
            }
            await stmt.finalize();
        }

        // 3. Get existing module IDs to manage deletions
        const existingModules = await db.all('SELECT id FROM modules WHERE course_id = ?', courseId);
        const existingModuleIds = new Set(existingModules.map(m => m.id));
        
        const payloadModuleIds = new Set(modules.filter(m => m.id).map(m => m.id));

        // Delete modules that are not in the payload
        for (const existingId of existingModuleIds) {
            if (!payloadModuleIds.has(existingId)) {
                await db.run('DELETE FROM modules WHERE id = ?', existingId);
            }
        }


        // 4. Upsert modules and lessons
        for (const [moduleIndex, moduleData] of modules.entries()) {
            let moduleId = moduleData.id;

            if (moduleId && existingModuleIds.has(moduleId)) {
                // Update existing module
                await db.run(
                    'UPDATE modules SET title = ?, "order" = ? WHERE id = ?',
                    [moduleData.title, moduleIndex + 1, moduleId]
                );
            } else {
                 // Insert new module
                const moduleResult = await db.run(
                    'INSERT INTO modules (course_id, title, "order") VALUES (?, ?, ?)',
                    [courseId, moduleData.title, moduleIndex + 1]
                );
                moduleId = moduleResult.lastID;
                if (!moduleId) {
                    throw new Error(`Failed to create module: ${moduleData.title}`);
                }
            }

            // Manage lessons for this module
            const existingLessons = await db.all('SELECT id FROM lessons WHERE module_id = ?', moduleId);
            const existingLessonIds = new Set(existingLessons.map(l => l.id));
            const payloadLessonIds = new Set(moduleData.lessons.filter(l => l.id).map(l => l.id));

            // Delete lessons not in payload
            for (const existingId of existingLessonIds) {
                if (!payloadLessonIds.has(existingId)) {
                    await db.run('DELETE FROM lessons WHERE id = ?', existingId);
                }
            }

            for (const [lessonIndex, lessonData] of moduleData.lessons.entries()) {
                let contentToStore = lessonData.content ?? null;
                if (lessonData.type === 'quiz' && lessonData.questions) {
                    contentToStore = transformQuestionsToDbFormat(lessonData.questions);
                }
                
                if (lessonData.id && existingLessonIds.has(lessonData.id)) {
                    // Update existing lesson
                     await db.run(
                        'UPDATE lessons SET title = ?, type = ?, content = ?, "order" = ?, imagePath = ? WHERE id = ?',
                        [lessonData.title, lessonData.type, contentToStore, lessonIndex + 1, lessonData.imagePath, lessonData.id]
                    );
                } else {
                     // Insert new lesson
                    await db.run(
                        'INSERT INTO lessons (module_id, title, type, content, "order", imagePath) VALUES (?, ?, ?, ?, ?, ?)',
                        [moduleId, lessonData.title, lessonData.type, contentToStore, lessonIndex + 1, lessonData.imagePath]
                    );
                }
            }
        }

        await db.run('COMMIT');

        const updatedCourse = await db.get('SELECT * FROM courses WHERE id = ?', courseId);
        return NextResponse.json(updatedCourse, { status: 200 });

    } catch (error) {
        if (db) {
            await db.run('ROLLBACK').catch(console.error);
        }
        console.error("Failed to update course:", error);
        return NextResponse.json({ error: 'Failed to update course due to a server error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}


export async function DELETE(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const { user, siteId } = await getCurrentSession();
    if (user?.role !== 'Admin' || !siteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let db;
    try {
        db = await getDb(siteId);
        const { id: courseId } = params;

        if (!courseId) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }
        
        await db.run('BEGIN TRANSACTION');

        // Manual cascade delete to ensure it works even if the DB schema was created without ON DELETE CASCADE.
        
        // 1. Find all modules for the course
        const modules = await db.all('SELECT id FROM modules WHERE course_id = ?', courseId);
        const moduleIds = modules.map(m => m.id);

        if (moduleIds.length > 0) {
            const moduleIdsPlaceholder = moduleIds.map(() => '?').join(',');

            // 2. Find all lessons for those modules
            const lessons = await db.all(`SELECT id FROM lessons WHERE module_id IN (${moduleIdsPlaceholder})`, moduleIds);
            const lessonIds = lessons.map(l => l.id);

            // 3. Delete from user_progress for those lessons
            if (lessonIds.length > 0) {
                const lessonIdsPlaceholder = lessonIds.map(() => '?').join(',');
                await db.run(`DELETE FROM user_progress WHERE lesson_id IN (${lessonIdsPlaceholder})`, lessonIds);
            }

            // 4. Delete from lessons for those modules
            await db.run(`DELETE FROM lessons WHERE module_id IN (${moduleIdsPlaceholder})`, moduleIds);
        }

        // 5. Delete from modules for the course
        await db.run('DELETE FROM modules WHERE course_id = ?', courseId);

        // 6. Finally, delete the course
        const result = await db.run('DELETE FROM courses WHERE id = ?', [courseId]);

        if (result.changes === 0) {
             await db.run('ROLLBACK');
             return NextResponse.json({ error: 'Course not found or already deleted' }, { status: 404 });
        }
        
        await db.run('COMMIT');

        return NextResponse.json({ success: true, message: `Course ${courseId} deleted successfully.` });

    } catch (error) {
        if (db) {
            await db.run('ROLLBACK').catch(console.error);
        }
        console.error("Failed to delete course:", error);
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: 'Failed to delete course due to a server error.', details }, { status: 500 });
    }
}
