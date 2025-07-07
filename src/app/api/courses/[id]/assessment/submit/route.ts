
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import { format } from 'date-fns';

const submissionSchema = z.object({
  answers: z.record(z.coerce.number()),
});

interface DbQuizQuestion {
    text: string;
    options: { text: string; isCorrect: boolean }[];
}

export async function POST(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    let db;
    try {
        db = await getDb(siteId);
        const courseId = parseInt(params.id, 10);
        
        if (isNaN(courseId)) {
            return NextResponse.json({ error: 'Invalid course ID.' }, { status: 400 });
        }
        
        const course = await db.get(
            'SELECT final_assessment_content, passing_rate, max_attempts FROM courses WHERE id = ?',
            courseId
        );
        if (!course || !course.final_assessment_content) {
            return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
        }
        
        const attempts = await db.all(
            'SELECT id FROM final_assessment_attempts WHERE user_id = ? AND course_id = ?',
            [user.id, courseId]
        );
        
        if (attempts.length >= course.max_attempts) {
            return NextResponse.json({ error: 'Maximum attempts reached.' }, { status: 403 });
        }
        
        const body = await request.json();
        const parsedBody = submissionSchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json({ error: 'Invalid submission format' }, { status: 400 });
        }
        const { answers } = parsedBody.data;

        await db.run('BEGIN TRANSACTION');

        const dbQuestions: DbQuizQuestion[] = JSON.parse(course.final_assessment_content);
        let score = 0;
        dbQuestions.forEach((question, index) => {
            const correctOptionIndex = question.options.findIndex(opt => opt.isCorrect);
            if (answers[index] === correctOptionIndex) {
                score++;
            }
        });
        
        const scorePercentage = (score / dbQuestions.length) * 100;
        const passed = scorePercentage >= course.passing_rate;

        await db.run(
            'INSERT INTO final_assessment_attempts (user_id, course_id, score, total, passed, attempt_date) VALUES (?, ?, ?, ?, ?, ?)',
            [user.id, courseId, score, dbQuestions.length, passed, new Date().toISOString()]
        );
        
        let certificateId: number | null = null;
        let retakeRequired = false;

        if (passed) {
            const existingCertificate = await db.get('SELECT id FROM certificates WHERE user_id = ? AND course_id = ?', [user.id, courseId]);
            if (!existingCertificate) {
                const today = new Date();
                const datePrefix = format(today, 'yyyyMMdd');
                const countResult = await db.get(`SELECT COUNT(*) as count FROM certificates WHERE certificate_number LIKE ?`, [`QAEHS-${datePrefix}-%`]);
                const nextSerial = (countResult?.count ?? 0) + 1;
                const certificateNumber = `QAEHS-${datePrefix}-${String(nextSerial).padStart(4, '0')}`;
                
                const certResult = await db.run(
                    `INSERT INTO certificates (user_id, course_id, completion_date, certificate_number, type) VALUES (?, ?, ?, ?, 'completion')`,
                    [user.id, courseId, today.toISOString(), certificateNumber]
                );
                certificateId = certResult.lastID;

                 if (certificateId) {
                    const courseSignatories = await db.all('SELECT signatory_id FROM course_signatories WHERE course_id = ?', courseId);
                    if (courseSignatories.length > 0) {
                        const stmt = await db.prepare('INSERT INTO certificate_signatories (certificate_id, signatory_id) VALUES (?, ?)');
                        for (const sig of courseSignatories) { await stmt.run(certificateId, sig.signatory_id); }
                        await stmt.finalize();
                    }
                }
            } else {
                 certificateId = existingCertificate.id;
            }
        } else {
             // Check if this was the last attempt
            if (attempts.length + 1 >= course.max_attempts) {
                retakeRequired = true;
                // Reset progress by deleting all user_progress entries for this course
                const lessons = await db.all(`SELECT l.id FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ?`, courseId);
                if (lessons.length > 0) {
                    const lessonIds = lessons.map(l => l.id);
                    await db.run(`DELETE FROM user_progress WHERE user_id = ? AND lesson_id IN (${lessonIds.map(() => '?').join(',')})`, [user.id, ...lessonIds]);
                }
            }
        }

        await db.run('COMMIT');

        return NextResponse.json({
            score,
            total: dbQuestions.length,
            passed,
            retakeRequired,
            certificateId
        });

    } catch (error) {
        if (db) await db.run('ROLLBACK').catch(console.error);
        const msg = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to submit assessment: ", msg, error);
        return NextResponse.json({ error: 'Failed to submit assessment' }, { status: 500 });
    }
}
