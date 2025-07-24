
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Payment history is only relevant for external users.
    if (user.type !== 'External') {
        return NextResponse.json([]);
    }

    try {
        const db = await getDb();
        const [transactions] = await db.query<RowDataPacket[]>(
            `SELECT 
                t.id, 
                t.course_id as courseId,
                t.amount,
                t.status,
                t.transaction_date,
                t.rejection_reason,
                c.title as courseTitle
             FROM transactions t
             JOIN courses c ON t.course_id = c.id
             WHERE t.user_id = ?
             ORDER BY t.transaction_date DESC`,
            [user.id]
        );
        return NextResponse.json(transactions);
    } catch (error) {
        console.error("Failed to fetch payment history for user:", error);
        return NextResponse.json({ error: 'Failed to fetch payment history' }, { status: 500 });
    }
}
