
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

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
    const { user } = await getCurrentSession();
    console.log('Session user:', user);
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = await getDb();
    try {
        const { lessonId: lessonIdStr, id: courseIdStr } = params;
        const lessonId = parseInt(lessonIdStr, 10);
        const courseId = parseInt(courseIdStr, 10);
        console.log('Params:', { lessonId, courseId });

        const [lessonRows] = await db.query<any[]>(`SELECT l.content FROM lessons l JOIN modules m ON l.module_id = m.id WHERE l.id = ? AND l.type = 'quiz' AND m.course_id = ?`, [lessonId, courseId]);
        console.log('Lesson query result:', lessonRows);

        const lesson = lessonRows[0];
        if (!lesson || !lesson.content) {
            console.log('Lesson content missing:', lesson);
            await db.query('ROLLBACK');
            return NextResponse.json({ error: 'Quiz not found or has no content.' }, { status: 404 });
        }

        let dbQuestions: DbQuizQuestion[];
        try {
            dbQuestions = JSON.parse(lesson.content);
            console.log('Parsed questions:', dbQuestions);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            console.error('JSON parse error:', errorMessage);
            await db.query('ROLLBACK');
            return NextResponse.json({ error: 'Failed to parse quiz content.' }, { status: 500 });
        }

        const body = await request.json();
        const parsedBody = quizSubmissionSchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json({ error: 'Invalid submission format' }, { status: 400 });
        }
        const { answers } = parsedBody.data;
        console.log('Submitted answers:', answers);

        await db.query('START TRANSACTION');
        console.log('Transaction started');

        let score = 0;
        const correctlyAnsweredIndices: number[] = [];
        dbQuestions.forEach((question, index) => {
            const correctOptionIndex = question.options.findIndex(opt => opt.isCorrect);
            if (answers[index] === correctOptionIndex) {
                score++;
                correctlyAnsweredIndices.push(index);
            }
        });
        console.log('Calculated score:', score);

        await db.query(
            'INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (?, ?, ?, ?, ?, ?)',
            [user.id, lessonId, courseId, score, dbQuestions.length, new Date().toISOString()]
        );
        console.log('Quiz attempt inserted');

        const passed = score === dbQuestions.length;
        let nextLessonId: number | null = null;
        let redirectToAssessment = false;

        if (passed) {
            const [totalLessonsRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(l.id) as count FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ?`, [courseId]);
            console.log('Total lessons query result:', totalLessonsRows);

            const [progressRows] = await db.query<any[]>(`SELECT completed FROM user_progress WHERE user_id = ? AND lesson_id = ?`, [user.id, lessonId]);
            console.log('Progress query result:', progressRows);

            await db.query(
                'INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE completed = 1',
                [user.id, lessonId]
            );
            console.log('User progress updated');

            const [allLessonsRows] = await db.query<any[]>(`SELECT l.id FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ? ORDER BY m.order ASC, l.order ASC`, [courseId]);
            console.log('All lessons query result:', allLessonsRows);
            
            const wasAlreadyCompleted = progressRows[0]?.completed === 1;
            const oldCompletedCount = (await db.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM user_progress up JOIN lessons l ON up.lesson_id = l.id JOIN modules m ON l.module_id = m.id WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1', [user.id, courseId]))[0][0].count;
            const newCompletedCount = wasAlreadyCompleted ? oldCompletedCount : oldCompletedCount + 1;
            
            if (newCompletedCount >= totalLessonsRows[0].count) {
                 const [courseInfoRows] = await db.query<any[]>(`SELECT final_assessment_content FROM courses WHERE id = ?`, [courseId]);
                 const courseInfo = courseInfoRows[0];
                 const hasFinalAssessment = !!courseInfo?.final_assessment_content;
                 if (hasFinalAssessment) {
                    redirectToAssessment = true;
                }
            }
            
            const allLessonsOrdered = allLessonsRows.map((l: any) => l.id);
            const currentIndex = allLessonsOrdered.findIndex((l_id: number) => l_id === lessonId);
            if (currentIndex !== -1 && currentIndex < allLessonsOrdered.length - 1) {
                nextLessonId = allLessonsOrdered[currentIndex + 1];
            }
        }

        await db.query('COMMIT');
        console.log('Transaction committed');

        return NextResponse.json({
            score,
            total: dbQuestions.length,
            passed,
            correctlyAnsweredIndices,
            nextLessonId,
            redirectToAssessment,
        });

    } catch (error) {
        const errorStack = error instanceof Error ? error.stack : 'No stack available';
        console.error('Unhandled error:', errorStack);
        await db.query('ROLLBACK').catch(e => console.error('Rollback failed:', e));
        return NextResponse.json({ error: 'Failed to process quiz submission' }, { status: 500 });
    }
}
