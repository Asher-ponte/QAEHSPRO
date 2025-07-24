
'use server'

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentSession } from '@/lib/session';
import { format } from 'date-fns';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function POST(
    request: NextRequest, 
    { params }: { params: { lessonId: string, id: string } }
) {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let db;
    try {
        db = await getDb();
        const lessonId = parseInt(params.lessonId, 10);
        const courseId = parseInt(params.id, 10);
        
        const today = new Date(); // Use a single timestamp

        if (isNaN(lessonId) || isNaN(courseId)) {
             return NextResponse.json({ error: 'Invalid course or lesson ID' }, { status: 400 });
        }
        
        const userId = user.id;
        
        const [lessonRows] = await db.query<any[]>('SELECT type FROM lessons WHERE id = ?', [lessonId]);
        const lesson = lessonRows[0];
        if (!lesson) {
            return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
        }
        if (lesson.type === 'quiz') {
            return NextResponse.json({ error: 'This endpoint cannot be used to complete quizzes.' }, { status: 400 });
        }

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
        
        await db.query('START TRANSACTION');

        const [totalLessonsRows] = await db.query<RowDataPacket[]>(
            `SELECT COUNT(l.id) as count FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ?`,
            [courseId]
        );
        const totalLessons = totalLessonsRows[0]?.count ?? 0;

        let nextLessonId: number | null = null;
        let certificateId: number | null = null;
        let redirectToAssessment = false;

        if (totalLessons > 0) {
            const [progressRows] = await db.query<any[]>(
                `SELECT completed FROM user_progress WHERE user_id = ? AND lesson_id = ?`,
                [userId, lessonId]
            );
            const wasAlreadyCompleted = progressRows[0]?.completed === 1;

            const [completedLessonsRows] = await db.query<RowDataPacket[]>(
                `SELECT COUNT(up.lesson_id) as count FROM user_progress up JOIN lessons l ON up.lesson_id = l.id JOIN modules m ON l.module_id = m.id WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1`,
                [userId, courseId]
            );
            const oldCompletedCount = completedLessonsRows[0]?.count ?? 0;

            await db.query(
                'INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE completed = 1',
                [userId, lessonId]
            );

            const newCompletedCount = wasAlreadyCompleted ? oldCompletedCount : oldCompletedCount + 1;
            
            if (newCompletedCount >= totalLessons) {
                const [courseInfoRows] = await db.query<any[]>('SELECT final_assessment_content FROM courses WHERE id = ?', [courseId]);
                const courseInfo = courseInfoRows[0];
                const hasFinalAssessment = !!courseInfo?.final_assessment_content;

                if (hasFinalAssessment) {
                    redirectToAssessment = true;
                } else {
                    const [existingCertRows] = await db.query<any[]>('SELECT id FROM certificates WHERE user_id = ? AND course_id = ?', [userId, courseId]);
                    const existingCertificate = existingCertRows[0];
                    if (!existingCertificate) {
                        const datePrefix = format(today, 'yyyyMMdd');
                        
                        const [certResult] = await db.query<ResultSetHeader>(
                            `INSERT INTO certificates (user_id, course_id, site_id, completion_date, certificate_number, type) VALUES (?, ?, ?, ?, ?, 'completion')`,
                            [userId, courseId, siteId, today.toISOString(), '']
                        );
                        certificateId = certResult.insertId;

                        const certificateNumber = `QAEHS-${datePrefix}-${String(certificateId).padStart(4, '0')}`;
                        await db.query('UPDATE certificates SET certificate_number = ? WHERE id = ?', [certificateNumber, certificateId]);


                        if (certificateId) {
                            const [signatoryRows] = await db.query<any[]>('SELECT signatory_id FROM course_signatories WHERE course_id = ?', [courseId]);
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

            const [allLessonsOrderedRows] = await db.query<any[]>(
                `SELECT l.id FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ? ORDER BY m.\`order\` ASC, l.\`order\` ASC`,
                [courseId]
            );
            const allLessonsOrdered = allLessonsOrderedRows.map(l => l.id);
            const currentIndex = allLessonsOrdered.findIndex(l_id => l_id === lessonId);
            
            if (currentIndex !== -1 && currentIndex < allLessonsOrdered.length - 1) {
                nextLessonId = allLessonsOrdered[currentIndex + 1];
            }
        }

        await db.query('COMMIT');
        return NextResponse.json({ success: true, nextLessonId, certificateId, redirectToAssessment });

    } catch (error) {
        if (db) await db.query('ROLLBACK').catch(console.error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to mark lesson as complete. Error: ", errorMessage, error);
        return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
    }
}
