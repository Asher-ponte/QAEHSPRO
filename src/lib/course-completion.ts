

'use server';

import type { Database } from 'sqlite';
import { format } from 'date-fns';

/**
 * Checks if a course is completed by a user and handles certificate creation or finds the next lesson.
 * This function should be called within an active database transaction.
 * @param userId The ID of the user.
 * @param courseId The ID of the course.
 * @param currentLessonId The ID of the lesson just completed.
 * @param db The database instance.
 * @returns An object with course completion status and next steps.
 */
export async function checkAndHandleCourseCompletion(
    userId: number,
    courseId: number,
    currentLessonId: number,
    db: Database
) {
    // 1. Get the total number of lessons for the course
    const totalLessonsResult = await db.get(
      `SELECT COUNT(l.id) as count
       FROM lessons l
       JOIN modules m ON l.module_id = m.id
       WHERE m.course_id = ?`,
      courseId
    );
    const totalLessons = totalLessonsResult?.count ?? 0;

    if (totalLessons === 0) {
        return { nextLessonId: null, certificateId: null };
    }

    // 2. Get the number of completed lessons for the user in this course
    const completedLessonsResult = await db.get(
      `SELECT COUNT(up.lesson_id) as count
       FROM user_progress up
       JOIN lessons l ON up.lesson_id = l.id
       JOIN modules m ON l.module_id = m.id
       WHERE up.user_id = ? AND m.course_id = ? AND up.completed = 1`,
      [userId, courseId]
    );
    const completedLessonsCount = completedLessonsResult?.count ?? 0;

    let nextLessonId: number | null = null;
    let certificateId: number | null = null;

    // 3. Check if the course is complete
    if (completedLessonsCount === totalLessons) {
        // Course is complete. Create a new certificate. This allows for re-training to generate new certificates.
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
            // Atomically copy all signatories assigned to the course to the new certificate
            await db.run(
                `INSERT INTO certificate_signatories (certificate_id, signatory_id)
                 SELECT ?, s.signatory_id
                 FROM course_signatories s
                 WHERE s.course_id = ?`,
                [certificateId, courseId]
            );
        }

    } else {
        // Course not complete, find the next lesson in sequence.
        const allLessonsOrderedResult = await db.all(
            `SELECT l.id FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ? ORDER BY m."order" ASC, l."order" ASC`,
            courseId
        );
        const allLessonsOrdered = allLessonsOrderedResult.map(l => l.id);
        const currentIndex = allLessonsOrdered.findIndex(l_id => l_id === currentLessonId);

        if (currentIndex !== -1 && currentIndex < allLessonsOrdered.length - 1) {
            nextLessonId = allLessonsOrdered[currentIndex + 1];
        }
    }

    return { nextLessonId, certificateId };
}
