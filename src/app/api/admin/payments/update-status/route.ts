
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';

const updateStatusSchema = z.object({
  transactionId: z.number(),
  status: z.enum(['completed', 'rejected']),
  rejectionReason: z.string().optional(),
});

export async function POST(request: NextRequest) {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
    }

    let db;
    try {
        const body = await request.json();
        const parsedData = updateStatusSchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { transactionId, status, rejectionReason } = parsedData.data;

        // All manual payments are in the 'external' DB
        db = await getDb('external');
        
        const transaction = await db.get('SELECT * FROM transactions WHERE id = ?', transactionId);
        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }
        
        if (transaction.status !== 'pending') {
             return NextResponse.json({ error: 'This transaction has already been processed.' }, { status: 409 });
        }
        
        await db.run('BEGIN TRANSACTION');

        if (status === 'completed') {
            await db.run('UPDATE transactions SET status = ? WHERE id = ?', ['completed', transactionId]);
        } else if (status === 'rejected') {
            if (!rejectionReason || rejectionReason.trim() === "") {
                await db.run('ROLLBACK');
                return NextResponse.json({ error: 'Rejection reason is required.' }, { status: 400 });
            }
            await db.run('UPDATE transactions SET status = ?, rejection_reason = ? WHERE id = ?', ['rejected', rejectionReason, transactionId]);
            
            // Un-enroll the user from the course upon rejection.
            await db.run('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?', [transaction.user_id, transaction.course_id]);
        }
        
        await db.run('COMMIT');

        return NextResponse.json({ success: true, message: `Transaction status updated to ${status}.` });

    } catch (error) {
        if (db) await db.run('ROLLBACK').catch(console.error);
        console.error("Failed to update transaction status:", error);
        return NextResponse.json({ error: 'Failed to update transaction status' }, { status: 500 });
    }
}

    