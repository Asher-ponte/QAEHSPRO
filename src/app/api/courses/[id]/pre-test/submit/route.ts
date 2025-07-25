
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';

const submissionSchema = z.object({
  answers: z.record(z.coerce.number()),
});

interface DbQuizQuestion {
    text: string;
    options: { text: string; isCorrect: boolean }[];
}

async function hasAccess(db: any, user: any, courseId: number) {
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
            'SELECT pre_test_content, pre_test_passing_rate, site_id FROM courses WHERE id = ?',
            [courseId]
        );
        const course = courseRows[0];
        if (!course || !course.pre_test_content) {
            return NextResponse.json({ error: 'Pre-test not found.' }, { status: 404 });
        }
        
        const [attempts] = await db.query<RowDataPacket[]>(
            'SELECT id FROM pre_test_attempts WHERE user_id = ? AND course_id = ?',
            [user.id, courseId]
        );
        
        if (attempts.length > 0) {
            return NextResponse.json({ error: 'You have already attempted this pre-test.' }, { status: 403 });
        }
        
        const body = await request.json();
        const parsedBody = submissionSchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json({ error: 'Invalid submission format' }, { status: 400 });
        }
        const { answers } = parsedBody.data;

        await db.query('START TRANSACTION');

        const dbQuestions: DbQuizQuestion[] = JSON.parse(course.pre_test_content);
        let score = 0;
        dbQuestions.forEach((question, index) => {
            const correctOptionIndex = question.options.findIndex(opt => opt.isCorrect);
            if (answers[index] === correctOptionIndex) {
                score++;
            }
        });
        
        const scorePercentage = (score / dbQuestions.length) * 100;
        const passed = scorePercentage >= (course.pre_test_passing_rate || 80);

        await db.query(
            'INSERT INTO pre_test_attempts (user_id, course_id, site_id, score, total, passed, attempt_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [user.id, courseId, course.site_id, score, dbQuestions.length, passed, new Date().toISOString()]
        );
        
        await db.query('COMMIT');

        return NextResponse.json({
            score,
            total: dbQuestions.length,
            passed,
        });

    } catch (error) {
        await db.query('ROLLBACK').catch(console.error);
        const msg = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to submit pre-test: ", msg, error);
        return NextResponse.json({ error: 'Failed to submit pre-test' }, { status: 500 });
    }
}
