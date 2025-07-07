
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export async function GET() {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
    }

    try {
        // Manual payments are only handled for the 'external' user database.
        const db = await getDb('external');
        const transactions = await db.all(`
            SELECT
                t.id,
                t.amount,
                t.status,
                t.gateway,
                t.transaction_date,
                t.proof_image_path,
                t.reference_number,
                t.rejection_reason,
                u.username as userName,
                c.title as courseTitle
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN courses c ON t.course_id = c.id
            ORDER BY
                CASE t.status
                    WHEN 'pending' THEN 1
                    WHEN 'rejected' THEN 2
                    WHEN 'completed' THEN 3
                    ELSE 4
                END,
                t.transaction_date DESC
        `);

        return NextResponse.json(transactions);
    } catch (error) {
        console.error("Failed to fetch transactions:", error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}
