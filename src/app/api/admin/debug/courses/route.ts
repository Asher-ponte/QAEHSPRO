
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const db = await getDb();
        const [courses] = await db.query<RowDataPacket[]>(
            `SELECT id, title FROM courses WHERE site_id != 'main' ORDER BY title ASC`
        );
        
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
