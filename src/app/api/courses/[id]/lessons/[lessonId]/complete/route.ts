
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

        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        const userId = user.id;

        if (isNaN(lessonId) || isNaN(courseId)) {
             return NextResponse.json({ error: 'Invalid course or lesson ID' }, { status: 400 });
        }

        if (user.role !== 'Admin') {
            const enrollment = await db.get('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [userId, courseId]);
            if (!enrollment) {
                return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
            }
        }

        // Use a transaction to ensure atomicity
        await db.run('BEGIN TRANSACTION');

        // Mark current lesson as complete
        const existingProgress = await db.get(
            'SELECT id FROM user_progress WHERE user_id = ? AND lesson_id = ?',
            [userId, lessonId]
        );

        if (!existingProgress) {
             await db.run(
                'INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (?, ?, 1)',
                [userId, lessonId]
            );
        } else {
             await db.run(
                'UPDATE user_progress SET completed = 1 WHERE id = ?',
                [existingProgress.id]
            );
        }

        // Find the next lesson in the course
        const allLessons = await db.all(
            `SELECT l.id FROM lessons l
             JOIN modules m ON l.module_id = m.id
             WHERE m.course_id = ?
             ORDER BY m."order" ASC, l."order" ASC`,
            [courseId]
        );

        const currentIndex = allLessons.findIndex(l => l.id === lessonId);

        let nextLessonId: number | null = null;
        let certificateId: number | null = null;
        if (currentIndex !== -1 && currentIndex < allLessons.length - 1) {
            nextLessonId = allLessons[currentIndex + 1].id;
        } else {
            // Course is complete, create certificate if all lessons are done
            const completedLessons = await db.get(
                `SELECT COUNT(*) as count FROM user_progress up
                 JOIN lessons l ON up.lesson_id = l.id
                 JOIN modules m ON l.module_id = m.id
                 WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1`,
                 [userId, courseId]
            );

            if (allLessons.length > 0 && completedLessons.count === allLessons.length) {
                // Generate certificate number
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
                const serialString = nextSerial.toString().padStart(3, '0');
                const certificateNumber = `QAEHS-${datePrefix}-${serialString}`;
                
                const result = await db.run(
                    `INSERT INTO certificates (user_id, course_id, completion_date, certificate_number) VALUES (?, ?, ?, ?)`,
                    [userId, courseId, new Date().toISOString(), certificateNumber]
                );
                
                certificateId = result.lastID ?? null;
            }
        }
        
        await db.run('COMMIT');

        return NextResponse.json({ success: true, nextLessonId, certificateId });

    } catch (error) {
        if (db) await db.run('ROLLBACK').catch(console.error);
        console.error("Failed to mark lesson as complete:", error);
        return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
    }
}
