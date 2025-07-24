
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const db = await getDb();
        const [certificates] = await db.query<RowDataPacket[]>(
            `SELECT 
                c.id, 
                c.user_id, 
                c.course_id, 
                c.completion_date, 
                c.type,
                c.reason,
                co.title
             FROM certificates c
             LEFT JOIN courses co ON c.course_id = co.id
             WHERE c.user_id = ?
             ORDER BY c.completion_date DESC`,
            [user.id]
        );
        return NextResponse.json(certificates);
    } catch (error) {
        console.error("Failed to fetch certificates for user:", error);
        return NextResponse.json({ error: 'Failed to fetch certificates' }, { status: 500 });
    }
}
