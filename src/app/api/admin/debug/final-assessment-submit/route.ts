
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getCertificateDataForValidation } from '@/lib/certificate';

const finalAssessmentTestSchema = z.object({
  userId: z.number(),
  courseId: z.number(),
  answers: z.record(z.coerce.number()),
});

interface DbQuizQuestion {
    text: string;
    options: { text: string; isCorrect: boolean }[];
}

export async function POST(request: NextRequest) {
    const { user: adminUser, isSuperAdmin } = await getCurrentSession();
    if (!adminUser || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required.' }, { status: 403 });
    }

    const db = await getDb();
    try {
        const body = await request.json();
        const parsedBody = finalAssessmentTestSchema.safeParse(body);

        if (!parsedBody.success) {
            return NextResponse.json({
                error: "Invalid request body.",
                details: parsedBody.error.flatten(),
            }, { status: 400 });
        }
        
        const { userId, courseId, answers } = parsedBody.data;

        await db.query('START TRANSACTION');

        const [userRows] = await db.query<RowDataPacket[]>('SELECT id FROM users WHERE id = ?', [userId]);
        if (userRows.length === 0) {
            await db.query('ROLLBACK');
            return NextResponse.json({ error: `User with ID ${userId} does not exist.` }, { status: 404 });
        }
        const testUser = userRows[0];
        
        const [courseRows] = await db.query<any[]>(
            'SELECT final_assessment_content, final_assessment_passing_rate, site_id FROM courses WHERE id = ?',
            [courseId]
        );
        const course = courseRows[0];
        if (!course || !course.final_assessment_content) {
            await db.query('ROLLBACK');
            return NextResponse.json({ error: `Final assessment not found for course ${courseId}.` }, { status: 404 });
        }

        let dbQuestions: DbQuizQuestion[];
        try {
            dbQuestions = JSON.parse(course.final_assessment_content);
        } catch (e) {
            await db.query('ROLLBACK');
            return NextResponse.json({ error: 'Failed to parse assessment content JSON.' }, { status: 500 });
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
        
        const scorePercentage = (score / dbQuestions.length) * 100;
        const passed = scorePercentage >= course.final_assessment_passing_rate;

        const [insertResult] = await db.query<ResultSetHeader>(
            'INSERT INTO final_assessment_attempts (user_id, course_id, score, total, passed, attempt_date) VALUES (?, ?, ?, ?, ?, ?)',
            [testUser.id, courseId, score, dbQuestions.length, passed, new Date()]
        );
        
        let certificateInsertId = null;
        let certificateNumber = null;
        let certificateData = null;

        if (passed) {
            const [certResult] = await db.query<ResultSetHeader>(`INSERT INTO certificates (user_id, course_id, site_id, completion_date, type, certificate_number) VALUES (?, ?, ?, ?, 'completion', 'SIMULATED')`, [testUser.id, courseId, course.site_id, new Date()]);
            certificateInsertId = certResult.insertId;
            
            // Now, fetch the full data payload for this new (temporary) certificate
            const { data, error } = await getCertificateDataForValidation('SIMULATED', course.site_id);
             if (error) {
                console.error("Debug certificate fetch failed:", error);
                // Don't fail the whole test, just note the error.
                certificateData = { error: "Failed to fetch certificate data after creation.", details: error };
            } else {
                certificateData = data;
            }
        }

        // We will rollback the transaction so this test doesn't permanently affect user data.
        await db.query('ROLLBACK');

        return NextResponse.json({
            message: "Simulation successful. All changes were rolled back.",
            simulation: {
                userId: testUser.id,
                courseId,
                answers,
                score,
                totalQuestions: dbQuestions.length,
                passingRateRequired: course.final_assessment_passing_rate,
                scorePercentage,
                passed,
                correctlyAnsweredIndices,
                assessmentAttemptInsertId: insertResult.insertId,
                certificateCreated: passed,
                simulatedCertificateId: certificateInsertId,
                generatedCertificateData: certificateData, // Add the fetched data to the response
            }
        });

    } catch (error) {
        await db.query('ROLLBACK').catch(e => console.error("Rollback failed during error handling:", e));
        
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error("[DEBUG] Final Assessment Test Failed:", error);
        return NextResponse.json({ error: 'Test failed during execution.', details: errorMessage, stack: errorStack }, { status: 500 });
    }
}
