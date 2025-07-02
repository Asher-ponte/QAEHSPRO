
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { z } from 'zod';

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
  modules: z.array(moduleSchema),
  imagePath: z.string().optional().nullable(),
})


export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    try {
        const db = await getDb();
        const { id: courseId } = params;

        if (!courseId) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        const course = await db.get('SELECT * FROM courses WHERE id = ?', courseId);
        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        const modules = await db.all('SELECT * FROM modules WHERE course_id = ? ORDER BY "order" ASC', courseId);
        
        for (const module of modules) {
            const lessons = await db.all('SELECT * FROM lessons WHERE module_id = ? ORDER BY "order" ASC', module.id);
            module.lessons = lessons.map(lesson => {
                if (lesson.type === 'quiz') {
                    return {
                        ...lesson,
                        questions: transformDbToQuestionsFormat(lesson.content),
                        content: null, // Clear content as it's now in questions
                    };
                }
                return { 
                    ...lesson, 
                    content: lesson.content ?? null,
                    imagePath: lesson.imagePath ?? null,
                };
            });
        }

        course.modules = modules;

        return NextResponse.json({
            ...course,
            imagePath: course.imagePath ?? null,
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
    let db;
    try {
        db = await getDb();
        const { id: courseId } = params;

        if (!courseId) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        const data = await request.json();
        const parsedData = courseSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { title, description, category, modules, imagePath } = parsedData.data;

        await db.run('BEGIN TRANSACTION');

        // 1. Update the course itself
        await db.run(
            'UPDATE courses SET title = ?, description = ?, category = ?, imagePath = ? WHERE id = ?',
            [title, description, category, imagePath, courseId]
        );

        // 2. Get existing module IDs to manage deletions
        const existingModules = await db.all('SELECT id FROM modules WHERE course_id = ?', courseId);
        const existingModuleIds = new Set(existingModules.map(m => m.id));
        
        const payloadModuleIds = new Set(modules.filter(m => m.id).map(m => m.id));

        // Delete modules that are not in the payload
        for (const existingId of existingModuleIds) {
            if (!payloadModuleIds.has(existingId)) {
                await db.run('DELETE FROM modules WHERE id = ?', existingId);
            }
        }


        // 3. Upsert modules and lessons
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
    let db;
    try {
        db = await getDb()
        const { id: courseId } = params

        if (!courseId) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        await db.run('BEGIN TRANSACTION');

        // By deleting the course, ON DELETE CASCADE will handle deleting all associated
        // modules, lessons, and user_progress entries automatically.
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
