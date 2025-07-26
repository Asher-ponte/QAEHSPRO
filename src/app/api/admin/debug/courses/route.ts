
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const mainOnly = request.nextUrl.searchParams.get('mainOnly') === 'true';

    try {
        const db = await getDb();
        
        let query;
        let params: string[] = [];

        if (mainOnly) {
            query = `SELECT id, title FROM courses WHERE site_id = ? ORDER BY title ASC`;
            params.push('main');
        } else {
            // Get all courses except those in 'main' for other tests
            query = `SELECT id, title FROM courses WHERE site_id != ? ORDER BY title ASC`;
            params.push('main');
        }

        const [courses] = await db.query<RowDataPacket[]>(query, params);
        
        const formattedCourses = courses.map(c => ({
            id: c.id,
            name: c.title,
        }));

        return NextResponse.json(formattedCourses);
    } catch (error) {
        console.error("Failed to fetch courses for debug:", error);
        return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 });
    }
}
