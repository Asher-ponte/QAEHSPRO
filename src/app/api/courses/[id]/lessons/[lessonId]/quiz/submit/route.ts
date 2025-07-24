
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import { format } from 'date-fns';
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
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId) {
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
        
        if (user.role !== 'Admin') {
            let hasAccess = false;
            const [enrollmentRows] = await db.query<RowDataPacket[]>('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [userId, courseId]);
            if (enrollmentRows.length > 0) hasAccess = true;

            if (!hasAccess && user.type === 'External') {
                const [transactionRows] = await db.query<RowDataPacket[]>(
                    `SELECT id FROM transactions WHERE user_id = ? AND course_id = ? AND status IN ('pending', 'completed')`,
                    [userId, courseId]
                );
                if (transactionRows.length > 0) hasAccess = true;
            }

            if (!hasAccess) {
                return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
            }
        }
        
        const body = await request.json();
        const parsedBody = quizSubmissionSchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json({ error: 'Invalid submission format' }, { status: 400 });
        }
        const { answers } = parsedBody.data;

        await db.query('START TRANSACTION');

        const [lessonRows] = await db.query<any[]>('SELECT content FROM lessons WHERE id = ? AND type = "quiz"', [lessonId]);
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
        const correctlyAnsweredIndices: number[] = [];
        dbQuestions.forEach((question, index) => {
            const correctOptionIndex = question.options.findIndex(opt => opt.isCorrect);
            if (answers[index] === correctOptionIndex) {
                score++;
                correctlyAnsweredIndices.push(index);
            }
        });

        await db.query(
            'INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, lessonId, courseId, score, dbQuestions.length, new Date().toISOString()]
        );
        
        const passed = score === dbQuestions.length;
        let nextLessonId: number | null = null;
        let certificateId: number | null = null;
        let redirectToAssessment = false;
        
        if (passed) {
            const [totalLessonsRows] = await db.query<RowDataPacket[]>(
                `SELECT COUNT(l.id) as count FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ?`,
                [courseId]
            );
            const totalLessons = totalLessonsRows[0]?.count ?? 0;
            const [progressRows] = await db.query<any[]>(`SELECT completed FROM user_progress WHERE user_id = ? AND lesson_id = ?`, [userId, lessonId]);
            const wasAlreadyCompleted = progressRows[0]?.completed === 1;
            
            const [completedCountRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(up.lesson_id) as count FROM user_progress up JOIN lessons l ON up.lesson_id = l.id JOIN modules m ON l.module_id = m.id WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1`, [userId, courseId]);
            const oldCompletedCount = completedCountRows[0]?.count ?? 0;
            
            await db.query(
                'INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE completed = 1',
                [userId, lessonId]
            );

            const newCompletedCount = wasAlreadyCompleted ? oldCompletedCount : oldCompletedCount + 1;

            if (newCompletedCount >= totalLessons) {
                const [courseInfoRows] = await db.query<any[]>('SELECT final_assessment_content FROM courses WHERE id = ?', [courseId]);
                const hasFinalAssessment = !!courseInfoRows[0]?.final_assessment_content;

                if (hasFinalAssessment) {
                    redirectToAssessment = true;
                } else {
                    const [existingCertRows] = await db.query<any[]>('SELECT id FROM certificates WHERE user_id = ? AND course_id = ?', [userId, courseId]);
                    const existingCertificate = existingCertRows[0];
                    if (!existingCertificate) {
                        const today = new Date();
                        
                        const [certInsertResult] = await db.query<ResultSetHeader>(
                            `INSERT INTO certificates (user_id, course_id, site_id, completion_date, certificate_number, type) VALUES (?, ?, ?, ?, ?, 'completion')`,
                            [userId, courseId, siteId, today.toISOString(), '']
                        );
                        certificateId = certInsertResult.insertId;

                        if (!certificateId) {
                            throw new Error("Failed to retrieve new certificate ID after insertion.");
                        }

                        // Use the newly inserted ID to generate the unique certificate number
                        const datePrefix = format(today, 'yyyyMMdd');
                        const certificateNumber = `QAEHS-${datePrefix}-${String(certificateId).padStart(4, '0')}`;
                        await db.query('UPDATE certificates SET certificate_number = ? WHERE id = ?', [certificateNumber, certificateId]);


                        if (certificateId && courseInfoRows[0]) {
                            const [signatoryRows] = await db.query<any[]>(
                                `SELECT cs.signatory_id FROM course_signatories cs
                                 JOIN signatories s ON cs.signatory_id = s.id
                                 WHERE cs.course_id = ? AND s.site_id = ?`, 
                                [courseId, siteId]
                            );
                            if (signatoryRows.length > 0) {
                                for (const sig of signatoryRows) {
                                    await db.query('INSERT INTO certificate_signatories (certificate_id, signatory_id) VALUES (?, ?)', [certificateId, sig.signatory_id]);
                                }
                            }
                        }
                    } else {
                        certificateId = existingCertificate.id;
                    }
                }
            }

            const [allLessonsRows] = await db.query<any[]>(
                `SELECT l.id FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ? ORDER BY m.\`order\` ASC, l.\`order\` ASC`,
                [courseId]
            );
            const allLessonsOrdered = allLessonsRows.map(l => l.id);
            const currentIndex = allLessonsOrdered.findIndex(l_id => l_id === lessonId);
            
            if (currentIndex !== -1 && currentIndex < allLessonsOrdered.length - 1) {
                nextLessonId = allLessonsOrdered[currentIndex + 1];
            }
        }
        
        await db.query('COMMIT');

        return NextResponse.json({
            score,
            total: dbQuestions.length,
            passed,
            correctlyAnsweredIndices,
            nextLessonId,
            certificateId,
            redirectToAssessment,
        });

    } catch (error) {
        await db.query('ROLLBACK').catch(e => console.error("Rollback failed", e));
        
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to process quiz submission. Error: ", errorMessage, error);
        return NextResponse.json({ error: 'Failed to process quiz submission' }, { status: 500 });
    }
}
