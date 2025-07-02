
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const db = await getDb();
        const certificates = await db.all(
            `SELECT c.id, c.user_id, c.course_id, c.completion_date, co.title
             FROM certificates c
             JOIN courses co ON c.course_id = co.id
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
