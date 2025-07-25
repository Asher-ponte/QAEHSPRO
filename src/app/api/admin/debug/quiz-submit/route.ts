
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const quizTestSchema = z.object({
  userId: z.number(),
  courseId: z.number(),
  lessonId: z.number(),
  answers: z.record(z.coerce.number()),
});

interface DbQuizQuestion {
    text: string;
    options: { text: string; isCorrect: boolean }[];
}

export async function POST(request: NextRequest) {
    const { user: adminUser, isSuperAdmin } = await getCurrentSession();
    if (!adminUser || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required.' }, { status: 403 });
    }

    const db = await getDb();
    try {
        const body = await request.json();
        const parsedBody = quizTestSchema.safeParse(body);

        if (!parsedBody.success) {
            return NextResponse.json({
                error: "Invalid request body.",
                details: parsedBody.error.flatten(),
            }, { status: 400 });
        }
        
        const { userId, courseId, lessonId, answers } = parsedBody.data;

        await db.query('START TRANSACTION');

        const [userRows] = await db.query<RowDataPacket[]>('SELECT id FROM users WHERE id = ?', [userId]);
        if (userRows.length === 0) {
            await db.query('ROLLBACK');
            return NextResponse.json({ error: `User with ID ${userId} does not exist.` }, { status: 404 });
        }
        const testUser = userRows[0];

        const [lessonRows] = await db.query<any[]>(`
            SELECT l.content 
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE l.id = ? AND l.type = 'quiz' AND m.course_id = ?
        `, [lessonId, courseId]);

        const lesson = lessonRows[0];
        if (!lesson || !lesson.content) {
            await db.query('ROLLBACK');
            return NextResponse.json({ error: `Quiz lesson with ID ${lessonId} not found for course ${courseId}.` }, { status: 404 });
        }
        
        let dbQuestions: DbQuizQuestion[];
        try {
            dbQuestions = JSON.parse(lesson.content);
        } catch (e) {
            await db.query('ROLLBACK');
            return NextResponse.json({ error: 'Failed to parse quiz content JSON.' }, { status: 500 });
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
        
        const insertResult = await db.query<ResultSetHeader>(
            'INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (?, ?, ?, ?, ?, ?)',
            [testUser.id, lessonId, courseId, score, dbQuestions.length, new Date()]
        );
        
        const passed = score === dbQuestions.length;
        if (passed) {
            await db.query(
                'INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE completed = 1',
                [testUser.id, lessonId]
            );
        }

        // We will rollback the transaction so this test doesn't permanently affect user data.
        await db.query('ROLLBACK');

        return NextResponse.json({
            message: "Simulation successful. Database changes were rolled back.",
            simulation: {
                userId: testUser.id,
                courseId,
                lessonId,
                answers,
                score,
                total: dbQuestions.length,
                passed,
                correctlyAnsweredIndices,
                quizAttemptInsertId: insertResult[0].insertId,
                userProgressUpdated: passed
            }
        });

    } catch (error) {
        await db.query('ROLLBACK').catch(e => console.error("Rollback failed during error handling:", e));
        
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error("[DEBUG] Quiz Submission Test Failed:", error);
        return NextResponse.json({ error: 'Test failed during execution.', details: errorMessage, stack: errorStack }, { status: 500 });
    }
}
