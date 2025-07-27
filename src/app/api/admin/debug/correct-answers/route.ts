
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

interface DbQuizQuestion {
    text: string;
    options: { text: string; isCorrect: boolean }[];
}

export async function GET(request: NextRequest) {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const courseId = request.nextUrl.searchParams.get('courseId');
    if (!courseId) {
        return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    try {
        const db = await getDb();
        const [courseRows] = await db.query<RowDataPacket & { final_assessment_content: string }[]>(
            `SELECT final_assessment_content FROM courses WHERE id = ?`,
            [courseId]
        );
        
        const course = courseRows[0];
        if (!course || !course.final_assessment_content) {
            return NextResponse.json({ error: 'Final assessment not found for this course.' }, { status: 404 });
        }
        
        let dbQuestions: DbQuizQuestion[];
        try {
            dbQuestions = JSON.parse(course.final_assessment_content);
        } catch (e) {
            return NextResponse.json({ error: 'Failed to parse assessment content JSON.' }, { status: 500 });
        }
        
        const correctAnswers: Record<string, number> = {};
        dbQuestions.forEach((question, index) => {
            const correctOptionIndex = question.options.findIndex(opt => opt.isCorrect);
            if (correctOptionIndex !== -1) {
                correctAnswers[index.toString()] = correctOptionIndex;
            }
        });

        return NextResponse.json({ answers: correctAnswers });
    } catch (error) {
        console.error("Failed to fetch correct answers for debug:", error);
        return NextResponse.json({ error: 'Failed to fetch correct answers' }, { status: 500 });
    }
}
