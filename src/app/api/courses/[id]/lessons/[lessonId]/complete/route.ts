

'use server'

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/session';
import { format } from 'date-fns';

export async function POST(
    request: NextRequest, 
    { params }: { params: { lessonId: string, id: string } }
) {
    let db;
    try {
        db = await getDb();
        const lessonId = parseInt(params.lessonId, 10);
        const courseId = parseInt(params.id, 10);

        if (isNaN(lessonId) || isNaN(courseId)) {
             return NextResponse.json({ error: 'Invalid course or lesson ID' }, { status: 400 });
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
        
        await db.run('BEGIN TRANSACTION');

        // Logic to check, update, and potentially create certificate atomically.

        // 1. Get total lessons for the course
        const totalLessonsResult = await db.get(
            `SELECT COUNT(l.id) as count FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ?`,
            courseId
        );
        const totalLessons = totalLessonsResult?.count ?? 0;

        let nextLessonId: number | null = null;
        let certificateId: number | null = null;

        if (totalLessons > 0) {
            // 2. Check if the current lesson was already complete BEFORE this transaction
            const progressRecord = await db.get(
                `SELECT completed FROM user_progress WHERE user_id = ? AND lesson_id = ?`,
                [userId, currentLessonId]
            );
            const wasAlreadyCompleted = progressRecord?.completed === 1;

            // 3. Get the number of completed lessons BEFORE this transaction
            const completedLessonsResult = await db.get(
                `SELECT COUNT(up.lesson_id) as count FROM user_progress up JOIN lessons l ON up.lesson_id = l.id JOIN modules m ON l.module_id = m.id WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1`,
                [userId, courseId]
            );
            const oldCompletedCount = completedLessonsResult?.count ?? 0;

            // 4. Update the current lesson's progress
            await db.run(
                'INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (?, ?, 1) ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed = 1',
                [userId, lessonId]
            );

            // 5. Calculate the new completed count
            const newCompletedCount = wasAlreadyCompleted ? oldCompletedCount : oldCompletedCount + 1;
            
            // 6. Check for completion and create certificate if needed
            if (newCompletedCount >= totalLessons) {
                // Prevent duplicate certificate creation
                const existingCertificate = await db.get('SELECT id FROM certificates WHERE user_id = ? AND course_id = ?', [userId, courseId]);
                if (!existingCertificate) {
                    const today = new Date();
                    const datePrefix = format(today, 'yyyyMMdd');
                    const countResult = await db.get(`SELECT COUNT(*) as count FROM certificates WHERE certificate_number LIKE ?`, [`QAEHS-${datePrefix}-%`]);
                    const nextSerial = (countResult?.count ?? 0) + 1;
                    const certificateNumber = `QAEHS-${datePrefix}-${String(nextSerial).padStart(4, '0')}`;
                    
                    const certResult = await db.run(
                        `INSERT INTO certificates (user_id, course_id, completion_date, certificate_number, type) VALUES (?, ?, ?, ?, 'completion')`,
                        [userId, courseId, today.toISOString(), certificateNumber]
                    );
                    certificateId = certResult.lastID ?? null;

                    if (certificateId) {
                        await db.run(
                            `INSERT INTO certificate_signatories (certificate_id, signatory_id)
                            SELECT ?, s.signatory_id
                            FROM course_signatories s
                            WHERE s.course_id = ?`,
                            [certificateId, courseId]
                        );
                    }
                } else {
                    certificateId = existingCertificate.id;
                }
            }

            // 7. Find the next lesson
            const allLessonsOrderedResult = await db.all(
                `SELECT l.id FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ? ORDER BY m."order" ASC, l."order" ASC`,
                courseId
            );
            const allLessonsOrdered = allLessonsOrderedResult.map(l => l.id);
            const currentIndex = allLessonsOrdered.findIndex(l_id => l_id === lessonId);
            
            if (currentIndex !== -1 && currentIndex < allLessonsOrdered.length - 1) {
                nextLessonId = allLessonsOrdered[currentIndex + 1];
            }
        }

        await db.run('COMMIT');
        return NextResponse.json({ success: true, nextLessonId, certificateId });

    } catch (error) {
        if (db) await db.run('ROLLBACK').catch(console.error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to mark lesson as complete. Error: ", errorMessage, error);
        return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
    }
}
