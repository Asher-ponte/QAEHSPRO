
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export async function GET() {
    const { user, siteId } = await getCurrentSession();
    if (user?.role !== 'Admin' || !siteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const db = await getDb(siteId);
        const transactions = await db.all(`
            SELECT
                t.id,
                t.amount,
                t.status,
                t.gateway,
                t.transaction_date,
                u.username as userName,
                c.title as courseTitle
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            JOIN courses c ON t.course_id = c.id
            ORDER BY t.transaction_date DESC
        `);
        return NextResponse.json(transactions);
    } catch (error) {
        console.error("Failed to fetch transactions:", error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}
