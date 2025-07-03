

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

        await db.run(
            'INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (?, ?, 1) ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed = 1',
            [userId, lessonId]
        );

        let nextLessonId: number | null = null;
        let certificateId: number | null = null;

        // --- Start of new completion check logic ---
        const allLessonsInCourse = await db.all(
            `SELECT l.id FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ?`,
            [courseId]
        );

        if (allLessonsInCourse.length > 0) {
            const courseLessonIds = new Set(allLessonsInCourse.map(l => l.id));
            
            const completedProgress = await db.all(
                `SELECT up.lesson_id FROM user_progress up
                    JOIN lessons l ON up.lesson_id = l.id
                    JOIN modules m ON l.module_id = m.id
                    WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1`,
                [userId, courseId]
            );
            const completedLessonIds = new Set(completedProgress.map(p => p.lesson_id));
            
            // Manually add the current lesson to our in-memory set to account for transaction isolation.
            completedLessonIds.add(lessonId);

            const isCourseComplete = courseLessonIds.size === completedLessonIds.size;

            if (isCourseComplete) {
                // Course is complete, issue a certificate
                const today = new Date();
                const datePrefix = format(today, 'yyyyMMdd');
                const countResult = await db.get(`SELECT COUNT(*) as count FROM certificates WHERE certificate_number LIKE ?`, [`QAEHS-${datePrefix}-%`]);
                const nextSerial = (countResult?.count ?? 0) + 1;
                const certificateNumber = `QAEHS-${datePrefix}-${String(nextSerial).padStart(4, '0')}`;
                
                const certResult = await db.run(
                    `INSERT INTO certificates (user_id, course_id, completion_date, certificate_number) VALUES (?, ?, ?, ?)`,
                    [userId, courseId, new Date().toISOString(), certificateNumber]
                );
                certificateId = certResult.lastID ?? null;
            } else {
                // Course not complete, find next lesson
                const allLessonsOrdered = await db.all(
                    `SELECT l.id FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ? ORDER BY m."order" ASC, l."order" ASC`,
                    [courseId]
                );
                const currentIndex = allLessonsOrdered.findIndex(l => l.id === lessonId);
                if (currentIndex !== -1 && currentIndex < allLessonsOrdered.length - 1) {
                    nextLessonId = allLessonsOrdered[currentIndex + 1].id;
                }
            }
        }
        // --- End of new completion check logic ---
        
        await db.run('COMMIT');

        return NextResponse.json({ success: true, nextLessonId, certificateId });

    } catch (error) {
        if (db) await db.run('ROLLBACK').catch(console.error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to mark lesson as complete. Error: ", errorMessage, error);
        return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
    }
}
