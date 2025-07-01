
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
  text: z.string().min(1, "Option text cannot be empty."),
});

const quizQuestionSchema = z.object({
  text: z.string().min(1, "Question text cannot be empty."),
  options: z.array(quizOptionSchema).min(2, "Must have at least two options."),
  correctOptionIndex: z.coerce.number().min(0, "A correct option must be selected."),
});

const lessonSchema = z.object({
  title: z.string().min(3),
  type: z.enum(["video", "document", "quiz"]),
  content: z.string().optional(),
  questions: z.array(quizQuestionSchema).optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'document' && (!data.content || data.content.trim().length < 10)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Document content must be at least 10 characters.", path: ['content'] });
    }
    if (data.type === 'quiz' && (!data.questions || data.questions.length < 1)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A quiz must have at least one question.", path: ['questions'] });
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


export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const db = await getDb();
    const { id: courseId } = params;

    if (!courseId) {
        return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    try {
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
                return lesson;
            });
        }

        course.modules = modules;

        return NextResponse.json(course);

    } catch (error) {
        console.error("Failed to fetch course for editing:", error);
        return NextResponse.json({ error: 'Failed to fetch course due to a server error' }, { status: 500 });
    }
}


export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const db = await getDb();
    const { id: courseId } = params;

    if (!courseId) {
        return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    try {
        const data = await request.json();
        const parsedData = courseSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { title, description, category, modules } = parsedData.data;
        const image = parsedData.data.image || 'https://placehold.co/600x400';
        const aiHint = parsedData.data.aiHint || 'education training';

        await db.run('BEGIN TRANSACTION');

        // 1. Update the course itself
        await db.run(
            'UPDATE courses SET title = ?, description = ?, category = ?, image = ?, aiHint = ? WHERE id = ?',
            [title, description, category, image, aiHint, courseId]
        );

        // 2. Get all module IDs for the course to find associated lessons
        const modulesToDelete = await db.all('SELECT id FROM modules WHERE course_id = ?', courseId);
        const moduleIdsToDelete = modulesToDelete.map(m => m.id);

        if (moduleIdsToDelete.length > 0) {
            const placeholders = moduleIdsToDelete.map(() => '?').join(',');
            
            // 3. Find all lessons to be deleted
            const lessonsToDelete = await db.all(`SELECT id FROM lessons WHERE module_id IN (${placeholders})`, moduleIdsToDelete);
            const lessonIdsToDelete = lessonsToDelete.map(l => l.id);

            // 4. Delete progress associated with those lessons
            if (lessonIdsToDelete.length > 0) {
                const lessonPlaceholders = lessonIdsToDelete.map(() => '?').join(',');
                await db.run(`DELETE FROM user_progress WHERE lesson_id IN (${lessonPlaceholders})`, lessonIdsToDelete);
            }
            
            // 5. Delete all lessons for the modules
            await db.run(`DELETE FROM lessons WHERE module_id IN (${placeholders})`, moduleIdsToDelete);
        }

        // 6. Delete all modules for the course
        await db.run('DELETE FROM modules WHERE course_id = ?', courseId);

        // 7. Re-insert modules and lessons from the payload
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
                    'INSERT INTO lessons (module_id, title, type, content, "order") VALUES (?, ?, ?, ?, ?)',
                    [moduleId, lessonData.title, lessonData.type, contentToStore, lessonIndex + 1]
                );
            }
        }

        await db.run('COMMIT');

        const updatedCourse = await db.get('SELECT * FROM courses WHERE id = ?', courseId);
        return NextResponse.json(updatedCourse, { status: 200 });

    } catch (error) {
        await db.run('ROLLBACK');
        console.error("Failed to update course:", error);
        return NextResponse.json({ error: 'Failed to update course due to a server error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}


export async function DELETE(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const db = await getDb()
    const { id: courseId } = params

    if (!courseId) {
        return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    try {
        await db.run('BEGIN TRANSACTION');

        const modulesToDelete = await db.all('SELECT id FROM modules WHERE course_id = ?', courseId);
        const moduleIdsToDelete = modulesToDelete.map(m => m.id);

        if (moduleIdsToDelete.length > 0) {
            const placeholders = moduleIdsToDelete.map(() => '?').join(',');
            
            const lessonsToDelete = await db.all(`SELECT id FROM lessons WHERE module_id IN (${placeholders})`, moduleIdsToDelete);
            const lessonIdsToDelete = lessonsToDelete.map(l => l.id);

            if (lessonIdsToDelete.length > 0) {
                const lessonPlaceholders = lessonIdsToDelete.map(() => '?').join(',');
                await db.run(`DELETE FROM user_progress WHERE lesson_id IN (${lessonPlaceholders})`, lessonIdsToDelete);
            }
            
            await db.run(`DELETE FROM lessons WHERE module_id IN (${placeholders})`, moduleIdsToDelete);
        }
        
        await db.run('DELETE FROM modules WHERE course_id = ?', [courseId]);

        const result = await db.run('DELETE FROM courses WHERE id = ?', [courseId]);

        await db.run('COMMIT');

        if (result.changes === 0) {
             await db.run('ROLLBACK');
             return NextResponse.json({ error: 'Course not found or already deleted' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: `Course ${courseId} deleted successfully.` });

    } catch (error) {
        await db.run('ROLLBACK');
        console.error("Failed to delete course:", error);
        return NextResponse.json({ error: 'Failed to delete course due to a server error' }, { status: 500 });
    }
}

    