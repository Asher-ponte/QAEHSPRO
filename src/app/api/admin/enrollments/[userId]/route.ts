
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    try {
        const db = await getDb();
        const { userId } = params;

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const enrollments = await db.all(`
            SELECT course_id FROM enrollments WHERE user_id = ?
        `, [userId]);
        
        const enrolledCourseIds = enrollments.map(e => e.course_id);
        
        return NextResponse.json(enrolledCourseIds);
    } catch (error) {
        console.error("Failed to fetch user enrollments:", error);
        return NextResponse.json({ error: 'Failed to fetch user enrollments' }, { status: 500 });
    }
}
