
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';

const quizSubmissionSchema = z.object({
  answers: z.record(z.coerce.number()),
});

interface DbQuizQuestion {
    text: string;
    options: { text: string; isCorrect: boolean }[];
}

async function hasAccess(db: any, user: any, courseId: number) {
    if (user.role === 'Admin') return true;
    const [enrollmentRows] = await db.query<RowDataPacket[]>('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [user.id, courseId]);
    if (enrollmentRows.length > 0) return true;
    if (user.type === 'External') {
        const [transactionRows] = await db.query<RowDataPacket[]>(`SELECT id FROM transactions WHERE user_id = ? AND course_id = ? AND status IN ('pending', 'completed')`, [user.id, courseId]);
        if (transactionRows.length > 0) return true;
    }
    return false;
}

export async function POST(
    request: NextRequest, 
    { params }: { params: { lessonId: string, id: string } }
) {
    const { user } = await getCurrentSession();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = await getDb();
    try {
        const { lessonId: lessonIdStr, id: courseIdStr } = params;
        const lessonId = parseInt(lessonIdStr, 10);
        const courseId = parseInt(courseIdStr, 10);

        if (isNaN(lessonId) || isNaN(courseId)) {
            return NextResponse.json({ error: 'Invalid course or lesson ID.' }, { status: 400 });
        }
        
        const canAccess = await hasAccess(db, user, courseId);
        if (!canAccess) {
             return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
        }

        const body = await request.json();
        const parsedBody = quizSubmissionSchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json({ error: 'Invalid submission format' }, { status: 400 });
        }
        const { answers } = parsedBody.data;

        const [lessonRows] = await db.query<any[]>(`
            SELECT l.content 
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE l.id = ? AND l.type = 'quiz' AND m.course_id = ?
        `, [lessonId, courseId]);

        const lesson = lessonRows[0];
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
        dbQuestions.forEach((question, index) => {
            const correctOptionIndex = question.options.findIndex(opt => opt.isCorrect);
            if (answers[index] === correctOptionIndex) {
                score++;
            }
        });
        
        await db.query(
            'INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (?, ?, ?, ?, ?, ?)',
            [user.id, lessonId, courseId, score, dbQuestions.length, new Date()]
        );
        
        const passed = score === dbQuestions.length;
        
        // This endpoint NO LONGER updates progress. It only grades the quiz.
        // The client will call the /complete endpoint if `passed` is true.

        return NextResponse.json({
            score,
            total: dbQuestions.length,
            passed,
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to process quiz submission. Error: ", errorMessage, error);
        return NextResponse.json({ error: 'Failed to process quiz submission' }, { status: 500 });
    }
}
