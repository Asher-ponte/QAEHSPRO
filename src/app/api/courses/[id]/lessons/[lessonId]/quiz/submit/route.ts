
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';

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

        if (user.role !== 'Admin') {
            let hasAccess = false;
            const [enrollmentRows] = await db.query<RowDataPacket[]>('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [user.id, courseId]);
            if (enrollmentRows.length > 0) hasAccess = true;

            if (!hasAccess && user.type === 'External') {
                const [transactionRows] = await db.query<RowDataPacket[]>(
                    `SELECT id FROM transactions WHERE user_id = ? AND course_id = ? AND status IN ('pending', 'completed')`,
                    [user.id, courseId]
                );
                if (transactionRows.length > 0) hasAccess = true;
            }

            if (!hasAccess) {
                return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
            }
        }

        const [lessonRows] = await db.query<any[]>(`
            SELECT l.content 
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE l.id = ? AND l.type = 'quiz' AND m.course_id = ?
        `, [lessonId, courseId]);
        console.log('Lesson query result:', lessonRows);

        const lesson = lessonRows[0];
        if (!lesson || !lesson.content) {
            console.log('Lesson content missing:', lesson);
            return NextResponse.json({ error: 'Quiz not found or has no content.' }, { status: 404 });
        }

        let dbQuestions: DbQuizQuestion[];
        try {
            dbQuestions = JSON.parse(lesson.content);
            console.log('Parsed questions:', dbQuestions);
        } catch (e: any) {
            console.error('JSON parse error:', e.message);
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
            console.log('Quiz passed. Updating progress...');
            const [totalLessonsRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(l.id) as count FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ?`, [courseId]);
            console.log('Total lessons query result:', totalLessonsRows);
            const totalLessons = totalLessonsRows[0]?.count ?? 0;

            const [progressRows] = await db.query<any[]>(`SELECT completed FROM user_progress WHERE user_id = ? AND lesson_id = ?`, [user.id, lessonId]);
            console.log('Progress query result:', progressRows);
            const wasAlreadyCompleted = progressRows[0]?.completed === 1;

            const [completedCountRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(up.lesson_id) as count FROM user_progress up JOIN lessons l ON up.lesson_id = l.id JOIN modules m ON l.module_id = m.id WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1`, [user.id, courseId]);
            const oldCompletedCount = completedCountRows[0]?.count ?? 0;

            await db.query(
                'INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE completed = 1',
                [user.id, lessonId]
            );
            console.log('User progress updated');

            const newCompletedCount = wasAlreadyCompleted ? oldCompletedCount : oldCompletedCount + 1;

            if (newCompletedCount >= totalLessons) {
                console.log('All lessons completed. Checking for final assessment.');
                const [courseInfoRows] = await db.query<any[]>(`SELECT final_assessment_content FROM courses WHERE id = ?`, [courseId]);
                const courseInfo = courseInfoRows[0];
                const hasFinalAssessment = !!courseInfo?.final_assessment_content;

                if (hasFinalAssessment) {
                    redirectToAssessment = true;
                }
            }

            const [allLessonsRows] = await db.query<any[]>(`SELECT l.id FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ? ORDER BY m.\`order\` ASC, l.\`order\` ASC`, [courseId]);
            console.log('All lessons query result:', allLessonsRows);

            const allLessonsOrdered = allLessonsRows.map(l => l.id);
            const currentIndex = allLessonsOrdered.findIndex(l_id => l_id === lessonId);
            
            if (currentIndex !== -1 && currentIndex < allLessonsOrdered.length - 1) {
                nextLessonId = allLessonsOrdered[currentIndex + 1];
            }
            console.log('Next lesson ID determined:', nextLessonId);
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

    } catch (error: any) {
        console.error('Unhandled error:', error instanceof Error ? error.stack : error);
        await db.query('ROLLBACK').catch(e => console.error('Rollback failed:', e));
        return NextResponse.json({ error: 'Failed to process quiz submission' }, { status: 500 });
    }
}
