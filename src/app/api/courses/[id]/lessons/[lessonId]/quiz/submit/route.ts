
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

// Helper for access check
async function hasAccess(db: any, user: any, courseId: number) {
    if (user.role === 'Admin') return true;
    
    // Check for direct enrollment
    const [enrollmentRows] = await db.query<RowDataPacket[]>('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [user.id, courseId]);
    if (enrollmentRows.length > 0) {
        return true;
    }
    
    // For external users, also check for a valid transaction
    if (user.type === 'External') {
        const [transactionRows] = await db.query<RowDataPacket[]>(
            `SELECT id FROM transactions WHERE user_id = ? AND course_id = ? AND status IN ('pending', 'completed')`,
            [user.id, courseId]
        );
        if (transactionRows.length > 0) {
            return true;
        }
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

        const userId = user.id;

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

        await db.query('START TRANSACTION');

        const [lessonRows] = await db.query<any[]>(`
            SELECT l.content 
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE l.id = ? AND l.type = 'quiz' AND m.course_id = ?
        `, [lessonId, courseId]);

        const lesson = lessonRows[0];
        if (!lesson || !lesson.content) {
            await db.query('ROLLBACK');
            return NextResponse.json({ error: 'Quiz not found or has no content.' }, { status: 404 });
        }
        
        let dbQuestions: DbQuizQuestion[];
        try {
            dbQuestions = JSON.parse(lesson.content);
        } catch (e) {
            await db.query('ROLLBACK');
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
            [userId, lessonId, courseId, score, dbQuestions.length, new Date().toISOString()]
        );
        
        const passed = score === dbQuestions.length;
        let nextLessonId: number | null = null;
        let redirectToAssessment = false;
        
        if (passed) {
            // First, mark the current lesson as complete
            await db.query(
                'INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE completed = 1',
                [userId, lessonId]
            );

            // Get all lessons for the course, in order
            const [allLessonsRows] = await db.query<any[]>(
                `SELECT l.id FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ? ORDER BY m.\`order\` ASC, l.\`order\` ASC`,
                [courseId]
            );
            const allLessonIds = allLessonsRows.map(l => l.id);

            // Get all of the user's completed lessons for this course
            const [completedLessonRows] = await db.query<RowDataPacket[]>(
                `SELECT lesson_id FROM user_progress WHERE user_id = ? AND lesson_id IN (?) AND completed = 1`,
                [userId, allLessonIds]
            );
            const completedLessonIds = new Set(completedLessonRows.map(row => row.lesson_id));

            // Determine if all lessons are now complete
            const allLessonsCompleted = allLessonIds.every(id => completedLessonIds.has(id));

            if (allLessonsCompleted) {
                // All lessons are done, check if there's a final assessment
                const [courseInfoRows] = await db.query<any[]>(`SELECT final_assessment_content FROM courses WHERE id = ?`, [courseId]);
                const hasFinalAssessment = !!courseInfoRows[0]?.final_assessment_content;
                if (hasFinalAssessment) {
                    redirectToAssessment = true;
                }
            } else {
                // Not all lessons are done, find the next one
                const currentLessonIndex = allLessonIds.findIndex(id => id === lessonId);
                if (currentLessonIndex !== -1 && currentLessonIndex < allLessonIds.length - 1) {
                    nextLessonId = allLessonIds[currentLessonIndex + 1];
                }
            }
        }
        
        await db.query('COMMIT');

        return NextResponse.json({
            score,
            total: dbQuestions.length,
            passed,
            nextLessonId,
            redirectToAssessment,
        });

    } catch (error) {
        await db.query('ROLLBACK').catch(e => console.error("Rollback failed", e));
        
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to process quiz submission. Error: ", errorMessage, error);
        return NextResponse.json({ error: 'Failed to process quiz submission' }, { status: 500 });
    }
}
