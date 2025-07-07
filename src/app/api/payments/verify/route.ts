
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';

const verifySchema = z.object({
  checkoutSessionId: z.string(),
});

export async function POST(request: NextRequest) {
    const { PAYMONGO_SECRET_KEY } = process.env;
    if (!PAYMONGO_SECRET_KEY) {
        return NextResponse.json({ error: 'Payment gateway is not configured.' }, { status: 500 });
    }
    
    let db;
    try {
        const body = await request.json();
        const parsedBody = verifySchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }
        const { checkoutSessionId } = parsedBody.data;

        // 1. Get session from PayMongo
        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY).toString('base64')}`
            }
        };

        const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${checkoutSessionId}`, options);
        const session = await response.json();

        if (!response.ok || session.errors) {
            console.error("PayMongo Error fetching session:", session.errors);
            throw new Error('Could not retrieve payment session details.');
        }

        const paymentIntent = session.data.attributes.payments[0];
        if (!paymentIntent || paymentIntent.attributes.status !== 'paid') {
            // Update transaction to failed if it's not paid
             db = await getDb('external');
             await db.run("UPDATE transactions SET status = 'failed' WHERE gateway_transaction_id = ?", checkoutSessionId);
            return NextResponse.json({ error: 'Payment was not successful.' }, { status: 402 });
        }

        // 2. Extract metadata and verify
        const metadata = session.data.attributes.metadata;
        const { userId, courseId, siteId } = metadata;
        if (!userId || !courseId || siteId !== 'external') {
            throw new Error("Payment session metadata is invalid or missing.");
        }
        
        // 3. Connect to DB and enroll user
        db = await getDb(siteId);

        // Idempotency check: see if user is already enrolled.
        const existingEnrollment = await db.get('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [userId, courseId]);
        if (existingEnrollment) {
            // If already enrolled, just update the transaction and return success.
            await db.run("UPDATE transactions SET status = 'completed' WHERE gateway_transaction_id = ?", checkoutSessionId);
            return NextResponse.json({ success: true, message: 'Already enrolled.' });
        }
        
        await db.run('BEGIN TRANSACTION');

        // Update the transaction from 'pending' to 'completed'
        await db.run("UPDATE transactions SET status = 'completed' WHERE gateway_transaction_id = ?", checkoutSessionId);
        
        // Enroll the user
        await db.run(
            'INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)',
            [userId, courseId]
        );

        await db.run('COMMIT');

        return NextResponse.json({ success: true, message: 'User enrolled successfully.' });

    } catch (error) {
        if (db) await db.run('ROLLBACK').catch(console.error);
        const msg = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to verify payment: ", msg, error);
        return NextResponse.json({ error: 'Failed to verify payment.' }, { status: 500 });
    }
}
