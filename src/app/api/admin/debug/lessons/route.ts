
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

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
        const [lessons] = await db.query<RowDataPacket[]>(
            `SELECT l.id, l.title 
             FROM lessons l
             JOIN modules m ON l.module_id = m.id
             WHERE m.course_id = ? AND l.type = 'quiz'
             ORDER BY l.title ASC`,
            [courseId]
        );
        
        const formattedLessons = lessons.map(l => ({
            id: l.id,
            name: l.title,
        }));

        return NextResponse.json(formattedLessons);
    } catch (error) {
        console.error("Failed to fetch quiz lessons for debug:", error);
        return NextResponse.json({ error: 'Failed to fetch quiz lessons' }, { status: 500 });
    }
}
