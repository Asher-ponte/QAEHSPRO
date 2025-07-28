
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import { format, subDays } from 'date-fns';
import type { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';

const submissionSchema = z.object({
  answers: z.record(z.coerce.number()),
});

interface DbQuizQuestion {
    text: string;
    options: { text: string; isCorrect: boolean }[];
}

async function hasAccess(db: Pool, user: any, courseId: number) {
    if (user.role === 'Admin') return true;
    const [enrollmentRows] = await db.query<RowDataPacket[]>('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [user.id, courseId]);
    if (enrollmentRows.length > 0) return true;
    if (user.type === 'External') {
        const [transactionRows] = await db.query<RowDataPacket[]>(`SELECT id FROM transactions WHERE user_id = ? AND course_id = ? AND status IN ('pending', 'completed')`, [user.id, courseId]);
        if (transactionRows.length > 0) return true;
    }
    return false;
}

export async function POST(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const { user } = await getCurrentSession();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const db = await getDb();
    try {
        const courseId = parseInt(params.id, 10);
        
        if (isNaN(courseId)) {
            return NextResponse.json({ error: 'Invalid course ID.' }, { status: 400 });
        }

        const canAccess = await hasAccess(db, user, courseId);
        if (!canAccess) {
             return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
        }
        
        const [courseRows] = await db.query<any[]>(
            'SELECT final_assessment_content, final_assessment_passing_rate, final_assessment_max_attempts FROM courses WHERE id = ?',
            [courseId]
        );
        const course = courseRows[0];
        if (!course || !course.final_assessment_content) {
            return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
        }
        
        const [attempts] = await db.query<RowDataPacket[]>(
            'SELECT id FROM final_assessment_attempts WHERE user_id = ? AND course_id = ?',
            [user.id, courseId]
        );
        
        if (attempts.length >= course.final_assessment_max_attempts) {
            return NextResponse.json({ error: 'Maximum attempts reached.' }, { status: 403 });
        }
        
        const body = await request.json();
        const parsedBody = submissionSchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json({ error: 'Invalid submission format' }, { status: 400 });
        }
        const { answers } = parsedBody.data;

        await db.query('START TRANSACTION');

        const dbQuestions: DbQuizQuestion[] = JSON.parse(course.final_assessment_content);
        let score = 0;
        dbQuestions.forEach((question, index) => {
            const correctOptionIndex = question.options.findIndex(opt => opt.isCorrect);
            if (answers[index] === correctOptionIndex) {
                score++;
            }
        });
        
        const passed = score === dbQuestions.length;

        await db.query(
            'INSERT INTO final_assessment_attempts (user_id, course_id, score, total, passed, attempt_date) VALUES (?, ?, ?, ?, ?, ?)',
            [user.id, courseId, score, dbQuestions.length, passed, new Date()]
        );
        
        let certificateId: number | null = null;
        let retakeRequired = false;

        if (passed) {
            const oneDayAgo = subDays(new Date(), 1);

            const [recentCertificateRows] = await db.query<any[]>(`SELECT id FROM certificates WHERE user_id = ? AND course_id = ? AND completion_date > ?`, [user.id, courseId, oneDayAgo]);
            const recentCertificate = recentCertificateRows[0];

            if (recentCertificate) {
                certificateId = recentCertificate.id;
            } else {
                const today = new Date();
                const completionDateFormatted = format(today, 'yyyy-MM-dd HH:mm:ss');
                const datePrefix = format(today, 'yyyyMMdd');
                const [countRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) as count FROM certificates WHERE certificate_number LIKE ?`, [`QAEHS-${datePrefix}-%`]);
                const count = countRows[0]?.count ?? 0;
                const nextSerial = count + 1;
                const certificateNumber = `QAEHS-${datePrefix}-${String(nextSerial).padStart(4, '0')}`;

                const [certResult] = await db.query<ResultSetHeader>(
                    `INSERT INTO certificates (user_id, course_id, completion_date, certificate_number, type) VALUES (?, ?, ?, ?, 'completion')`,
                    [user.id, courseId, completionDateFormatted, certificateNumber]
                );
                certificateId = certResult.insertId;

                const [courseSignatoryRows] = await db.query<any[]>(`SELECT signatory_id FROM course_signatories WHERE course_id = ?`, [courseId]);
                if (courseSignatoryRows.length > 0) {
                    for (const sig of courseSignatoryRows) { 
                        await db.query('INSERT INTO certificate_signatories (certificate_id, signatory_id) VALUES (?, ?)', [certificateId, sig.signatory_id]);
                    }
                }
            }
        } else {
            if (attempts.length + 1 >= course.final_assessment_max_attempts) {
                retakeRequired = true;
            }
        }

        await db.query('COMMIT');

        return NextResponse.json({
            score,
            total: dbQuestions.length,
            passed,
            retakeRequired,
            certificateId
        });

    } catch (error) {
        await db.query('ROLLBACK').catch(console.error);
        const msg = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to submit assessment: ", msg, error);
        return NextResponse.json({ error: 'Failed to submit assessment', details: msg }, { status: 500 });
    }
}
