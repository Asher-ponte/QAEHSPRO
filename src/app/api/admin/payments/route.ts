
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { getAllSites } from '@/lib/sites';

export async function GET() {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
    }

    try {
        const allSites = await getAllSites();
        let allTransactions = [];

        for (const site of allSites) {
            // We only care about transactions from external users for platform-wide revenue.
            if (site.id !== 'external') continue;
            
            const db = await getDb(site.id);
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
            allTransactions.push(...transactions);
        }

        // Sort all transactions by date after aggregating them
        allTransactions.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

        return NextResponse.json(allTransactions);
    } catch (error) {
        console.error("Failed to fetch transactions:", error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}
