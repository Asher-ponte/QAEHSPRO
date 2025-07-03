
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { z } from 'zod';
import { format } from 'date-fns';

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
    const db = await getDb()
    const { lessonId: lessonIdStr, id: courseIdStr } = params;
    const lessonId = parseInt(lessonIdStr, 10);
    const courseId = parseInt(courseIdStr, 10);

    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const userId = user.id;

    if (isNaN(lessonId) || isNaN(courseId)) {
        return NextResponse.json({ error: 'Invalid course or lesson ID.' }, { status: 400 });
    }

    if (user.role !== 'Admin') {
        const enrollment = await db.get('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [userId, courseId]);
        if (!enrollment) {
            return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
        }
    }
    
    try {
        const body = await request.json();
        const parsedBody = quizSubmissionSchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json({ error: 'Invalid submission format' }, { status: 400 });
        }
        const { answers } = parsedBody.data;

        // Fetch the quiz content to validate answers against
        const lesson = await db.get('SELECT content FROM lessons WHERE id = ? AND type = "quiz"', lessonId);
        if (!lesson || !lesson.content) {
            return NextResponse.json({ error: 'Quiz not found or has no content.' }, { status: 404 });
        }
        
        const dbQuestions: DbQuizQuestion[] = JSON.parse(lesson.content);
        let score = 0;
        const correctlyAnsweredIndices: number[] = [];

        dbQuestions.forEach((question, index) => {
            const correctOptionIndex = question.options.findIndex(opt => opt.isCorrect);
            if (answers[index] === correctOptionIndex) {
                score++;
                correctlyAnsweredIndices.push(index);
            }
        });

        // Use a transaction for atomicity
        await db.run('BEGIN TRANSACTION');

        // Record the attempt
        await db.run(
            'INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, lessonId, courseId, score, dbQuestions.length, new Date().toISOString()]
        );
        
        const passed = score === dbQuestions.length;
        let nextLessonId: number | null = null;
        let certificateId: number | null = null;

        if (passed) {
            // Mark lesson as complete
            await db.run(
                'INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (?, ?, 1) ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed = 1',
                [userId, lessonId]
            );

            // Check if course is complete
            const allLessons = await db.all(
                `SELECT l.id FROM lessons l
                 JOIN modules m ON l.module_id = m.id
                 WHERE m.course_id = ?
                 ORDER BY m."order" ASC, l."order" ASC`,
                [courseId]
            );

            const currentIndex = allLessons.findIndex(l => l.id === lessonId);

            if (currentIndex !== -1 && currentIndex < allLessons.length - 1) {
                nextLessonId = allLessons[currentIndex + 1].id;
            } else {
                // Last lesson, check for full course completion
                const completedLessons = await db.get(
                    `SELECT COUNT(*) as count FROM user_progress up
                     JOIN lessons l ON up.lesson_id = l.id
                     JOIN modules m ON l.module_id = m.id
                     WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1`,
                     [userId, courseId]
                );

                if (allLessons.length > 0 && completedLessons && completedLessons.count === allLessons.length) {
                    // Generate certificate
                    const today = new Date();
                    const datePrefix = format(today, 'yyyy-MM-dd');
                    const lastCertForToday = await db.get(
                        `SELECT certificate_number FROM certificates 
                        WHERE certificate_number LIKE ? 
                        ORDER BY certificate_number DESC 
                        LIMIT 1`,
                        [`QAEHS-${datePrefix}-%`]
                    );
                    let nextSerial = 1;
                    if (lastCertForToday?.certificate_number) {
                        const lastSerial = parseInt(lastCertForToday.certificate_number.split('-').pop()!, 10);
                        if (!isNaN(lastSerial)) {
                           nextSerial = lastSerial + 1;
                        }
                    }
                    const certificateNumber = `QAEHS-${datePrefix}-${String(nextSerial).padStart(3, '0')}`;
                    
                    const result = await db.run(
                        `INSERT INTO certificates (user_id, course_id, completion_date, certificate_number) VALUES (?, ?, ?, ?)`,
                        [userId, courseId, new Date().toISOString(), certificateNumber]
                    );
                    certificateId = result.lastID ?? null;
                }
            }
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
        await db.run('ROLLBACK').catch(e => console.error("Rollback failed", e));
        console.error("Failed to submit quiz:", error);
        return NextResponse.json({ error: 'Failed to process quiz submission' }, { status: 500 });
    }
}
