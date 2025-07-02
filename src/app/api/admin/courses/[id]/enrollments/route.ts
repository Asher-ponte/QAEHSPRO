
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const db = await getDb();
        const { id: courseId } = params;

        if (!courseId) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        const enrollments = await db.all(`
            SELECT user_id FROM enrollments WHERE course_id = ?
        `, [courseId]);
        
        const enrolledUserIds = enrollments.map(e => e.user_id);
        
        return NextResponse.json(enrolledUserIds);
    } catch (error) {
        console.error("Failed to fetch course enrollments:", error);
        return NextResponse.json({ error: 'Failed to fetch course enrollments' }, { status: 500 });
    }
}
