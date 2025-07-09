
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
        
        console.log(`[Admin Action] Updating transaction ${transactionId} to status: ${status}`);

        const transaction = await db.get('SELECT * FROM transactions WHERE id = ?', transactionId);
        if (!transaction) {
            console.error(`Transaction with ID ${transactionId} not found.`);
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }
        
        if (transaction.status !== 'pending') {
             console.warn(`Attempted to process an already-processed transaction. ID: ${transactionId}, Status: ${transaction.status}`);
             return NextResponse.json({ error: 'This transaction has already been processed.' }, { status: 409 });
        }
        
        await db.run('BEGIN TRANSACTION');
        console.log("Transaction started.");

        if (status === 'completed') {
            await db.run('UPDATE transactions SET status = ? WHERE id = ?', ['completed', transactionId]);
            console.log(`Transaction ${transactionId} status updated to 'completed'.`);
        } else if (status === 'rejected') {
            if (!rejectionReason || rejectionReason.trim() === "") {
                await db.run('ROLLBACK');
                console.error("Rejection attempt failed: Reason is required.");
                return NextResponse.json({ error: 'Rejection reason is required.' }, { status: 400 });
            }
            await db.run('UPDATE transactions SET status = ?, rejection_reason = ? WHERE id = ?', ['rejected', rejectionReason, transactionId]);
            console.log(`Transaction ${transactionId} status updated to 'rejected'.`);
            
            // Un-enroll the user from the course upon rejection.
            const { user_id, course_id } = transaction;
            if (!user_id || !course_id) {
                // This should not happen due to NOT NULL constraints, but it's a good safeguard.
                throw new Error(`Transaction ${transactionId} is missing user_id or course_id.`);
            }

            console.log(`Attempting to un-enroll user ${user_id} from course ${course_id}.`);
            const deleteResult = await db.run('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?', [user_id, course_id]);
            
            if (deleteResult.changes > 0) {
                 console.log(`Successfully un-enrolled user ${user_id} from course ${course_id}.`);
            } else {
                 console.warn(`No enrollment record found to delete for user ${user_id} and course ${course_id}. This may be okay if already removed.`);
            }
        }
        
        await db.run('COMMIT');
        console.log("Transaction committed successfully.");

        return NextResponse.json({ success: true, message: `Transaction status updated to ${status}.` });

    } catch (error) {
        if (db) {
            console.error("An error occurred, rolling back transaction.");
            await db.run('ROLLBACK').catch(console.error);
        }
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to update transaction status:", message, error);
        return NextResponse.json({ error: 'Failed to update transaction status.', details: message }, { status: 500 });
    }
}
