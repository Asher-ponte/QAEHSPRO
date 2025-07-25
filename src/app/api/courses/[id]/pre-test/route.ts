
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

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

export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const db = await getDb();
        const courseId = parseInt(params.id, 10);
        
        if (isNaN(courseId)) {
            return NextResponse.json({ error: 'Invalid course ID.' }, { status: 400 });
        }

        const canAccess = await hasAccess(db, user, courseId);
        if (!canAccess) {
             return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
        }

        const [courseRows] = await db.query<RowDataPacket[]>('SELECT title, pre_test_content FROM courses WHERE id = ? AND site_id = ?', [courseId, siteId]);
        const course = courseRows[0];
        
        if (!course || !course.pre_test_content) {
            return NextResponse.json({ error: 'Pre-test not found for this course.' }, { status: 404 });
        }
        
        let questionsForStudent: { text: string; options: { text: string }[] }[] = [];
        try {
            const dbQuestions: DbQuizQuestion[] = JSON.parse(course.pre_test_content);
            questionsForStudent = dbQuestions.map(q => ({
                text: q.text,
                options: q.options.map(opt => ({ text: opt.text }))
            }));
        } catch (e) {
             return NextResponse.json({ error: 'Failed to parse pre-test questions.' }, { status: 500 });
        }
        
        const [attempts] = await db.query<RowDataPacket[]>(
            'SELECT id FROM pre_test_attempts WHERE user_id = ? AND course_id = ? AND site_id = ?',
            [user.id, courseId, siteId]
        );

        return NextResponse.json({
            courseTitle: course.title,
            questions: questionsForStudent,
            hasAttempted: attempts.length > 0,
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to fetch pre-test data: ", msg, error);
        return NextResponse.json({ error: 'Failed to fetch pre-test data' }, { status: 500 });
    }
}
