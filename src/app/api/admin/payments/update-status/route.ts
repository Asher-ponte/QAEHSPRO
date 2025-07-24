
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

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

    const db = await getDb();
    let transactionIdForError: number | null = null;
    let statusForError: string | null = null;
    
    try {
        const body = await request.json();
        const parsedData = updateStatusSchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { transactionId, status, rejectionReason } = parsedData.data;
        transactionIdForError = transactionId;
        statusForError = status;

        console.log(`[Admin Action] Attempting to update transaction ${transactionId} to status: ${status}`);

        await db.query('START TRANSACTION');

        const [transactionRows] = await db.query<RowDataPacket[]>('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [transactionId]);
        const transaction = transactionRows[0];

        if (!transaction) {
            console.error(`Transaction with ID ${transactionId} not found.`);
            await db.query('ROLLBACK');
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }
        
        if (transaction.status !== 'pending') {
             console.warn(`Attempted to process an already-processed transaction. ID: ${transactionId}, Status: ${transaction.status}`);
             await db.query('ROLLBACK');
             return NextResponse.json({ error: 'This transaction has already been processed.' }, { status: 409 });
        }
        
        if (status === 'completed') {
            await db.query("UPDATE transactions SET status = 'completed' WHERE id = ?", [transactionId]);
            console.log(`Transaction ${transactionId} status updated to 'completed'.`);
        } else if (status === 'rejected') {
            if (!rejectionReason || rejectionReason.trim() === "") {
                await db.query('ROLLBACK');
                console.error("Rejection attempt failed: Reason is required.");
                return NextResponse.json({ error: 'Rejection reason is required.' }, { status: 400 });
            }
            
            await db.query("UPDATE transactions SET status = 'rejected', rejection_reason = ? WHERE id = ?", [rejectionReason, transactionId]);
            console.log(`Transaction ${transactionId} status updated to 'rejected'.`);
            
            const { user_id, course_id } = transaction;
            if (!user_id || !course_id) {
                await db.query('ROLLBACK');
                throw new Error(`Transaction ${transactionId} is missing user_id or course_id.`);
            }

            console.log(`Attempting to un-enroll user ${user_id} from course ${course_id}.`);
            await db.query('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?', [user_id, course_id]);
            console.log(`Successfully un-enrolled user ${user_id} from course ${course_id}.`);
        }
        
        await db.query('COMMIT');
        console.log("Transaction committed successfully.");

        return NextResponse.json({ success: true, message: `Transaction status updated to ${status}.` });

    } catch (error) {
        await db.query('ROLLBACK').catch(e => console.error("Rollback failed:", e));
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error(`Failed to update transaction status for ID: ${transactionIdForError}, intended status: ${statusForError}. Error:`, message, error);
        return NextResponse.json({ error: 'Failed to update transaction status.', details: message }, { status: 500 });
    }
}
