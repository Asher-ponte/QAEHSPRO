
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

// This is an internal type, not exposed to the client.
interface DbQuizQuestion {
    text: string;
    options: { text: string; isCorrect: boolean }[];
}

// Helper for access check
async function hasAccess(db: any, user: any, courseId: number) {
    if (user.role === 'Admin') return true;
    
    // Check for direct enrollment
    const enrollment = await db.get('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [user.id, courseId]);
    if (enrollment) {
        return true;
    }
    
    // For external users, also check for a valid transaction
    if (user.type === 'External') {
        const transaction = await db.get(
            `SELECT id FROM transactions WHERE user_id = ? AND course_id = ? AND status IN ('pending', 'completed')`,
            [user.id, courseId]
        );
        if (transaction) {
            return true;
        }
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
        const db = await getDb(siteId);
        const courseId = parseInt(params.id, 10);
        
        if (isNaN(courseId)) {
            return NextResponse.json({ error: 'Invalid course ID.' }, { status: 400 });
        }

        // --- ACCESS CONTROL ---
        const canAccess = await hasAccess(db, user, courseId);
        if (!canAccess) {
             return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
        }
        // --- END ACCESS CONTROL ---

        const course = await db.get('SELECT title, passing_rate, max_attempts, final_assessment_content FROM courses WHERE id = ?', courseId);
        if (!course || !course.final_assessment_content) {
            return NextResponse.json({ error: 'Final assessment not found for this course.' }, { status: 404 });
        }
        
        let questionsForStudent: { text: string; options: { text: string }[] }[] = [];
        try {
            const dbQuestions: DbQuizQuestion[] = JSON.parse(course.final_assessment_content);
            questionsForStudent = dbQuestions.map(q => ({
                text: q.text,
                options: q.options.map(opt => ({ text: opt.text }))
            }));
        } catch (e) {
             return NextResponse.json({ error: 'Failed to parse assessment questions.' }, { status: 500 });
        }
        
        const attempts = await db.all(
            'SELECT * FROM final_assessment_attempts WHERE user_id = ? AND course_id = ? ORDER BY attempt_date DESC',
            [user.id, courseId]
        );

        return NextResponse.json({
            courseTitle: course.title,
            questions: questionsForStudent,
            passingRate: course.passing_rate,
            maxAttempts: course.max_attempts,
            attempts: attempts,
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to fetch assessment data: ", msg, error);
        return NextResponse.json({ error: 'Failed to fetch assessment data' }, { status: 500 });
    }
}
