

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { z } from 'zod';
import { checkAndHandleCourseCompletion } from '@/lib/course-completion';

const quizSubmissionSchema = z.object({
  answers: z.record(z.coerce.number()),
});

// This is an internal type, not exposed to the client.
interface DbQuizQuestion {
    text: string;
    options: { text: string; isCorrect: boolean }[];
}


export async function POST(
    request: NextRequest, 
    { params }: { params: { lessonId: string, id: string } }
) {
    let db;
    try {
        db = await getDb();
        const { lessonId: lessonIdStr, id: courseIdStr } = params;
        const lessonId = parseInt(lessonIdStr, 10);
        const courseId = parseInt(courseIdStr, 10);

        if (isNaN(lessonId) || isNaN(courseId)) {
            return NextResponse.json({ error: 'Invalid course or lesson ID.' }, { status: 400 });
        }

        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        const userId = user.id;
        
        if (user.role !== 'Admin') {
            const enrollment = await db.get('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [userId, courseId]);
            if (!enrollment) {
                return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
            }
        }
        
        const body = await request.json();
        const parsedBody = quizSubmissionSchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json({ error: 'Invalid submission format' }, { status: 400 });
        }
        const { answers } = parsedBody.data;

        await db.run('BEGIN TRANSACTION');

        const lesson = await db.get('SELECT content FROM lessons WHERE id = ? AND type = "quiz"', lessonId);
        if (!lesson || !lesson.content) {
            return NextResponse.json({ error: 'Quiz not found or has no content.' }, { status: 404 });
        }
        
        let dbQuestions: DbQuizQuestion[];
        try {
            dbQuestions = JSON.parse(lesson.content);
        } catch (e) {
            return NextResponse.json({ error: 'Failed to parse quiz content.' }, { status: 500 });
        }
        
        let score = 0;
        const correctlyAnsweredIndices: number[] = [];
        dbQuestions.forEach((question, index) => {
            const correctOptionIndex = question.options.findIndex(opt => opt.isCorrect);
            if (answers[index] === correctOptionIndex) {
                score++;
                correctlyAnsweredIndices.push(index);
            }
        });

        // Log the quiz attempt for analytics.
        await db.run(
            'INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, lessonId, courseId, score, dbQuestions.length, new Date().toISOString()]
        );
        
        const passed = score === dbQuestions.length;
        let nextLessonId: number | null = null;
        let certificateId: number | null = null;
        
        if (passed) {
            // Mark quiz lesson as complete.
            await db.run(
                'INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (?, ?, 1) ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed = 1',
                [userId, lessonId]
            );

            const completionResult = await checkAndHandleCourseCompletion(userId, courseId, lessonId, db);
            nextLessonId = completionResult.nextLessonId;
            certificateId = completionResult.certificateId;
        }
        
        await db.run('COMMIT');

        return NextResponse.json({
            score,
            total: dbQuestions.length,
            passed,
            correctlyAnsweredIndices,
            nextLessonId,
            certificateId,
        });

    } catch (error) {
        if (db) await db.run('ROLLBACK').catch(e => console.error("Rollback failed", e));
        
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to process quiz submission. Error: ", errorMessage, error);
        return NextResponse.json({ error: 'Failed to process quiz submission' }, { status: 500 });
    }
}
