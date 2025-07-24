
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';

const verifySchema = z.object({
  checkoutSessionId: z.string(),
});

export async function POST(request: NextRequest) {
    const { PAYMONGO_SECRET_KEY } = process.env;
    if (!PAYMONGO_SECRET_KEY) {
        console.error("Payment gateway secret key is not set.");
        return NextResponse.json({ error: 'Payment gateway is not configured on the server.' }, { status: 500 });
    }
    
    const db = await getDb();
    
    try {
        const body = await request.json();
        const parsedBody = verifySchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json({ error: 'Invalid request: Missing checkout session ID.' }, { status: 400 });
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

        // Check for PayMongo's own error structure first
        if (!response.ok || session.errors) {
            const errorDetail = session.errors ? session.errors[0]?.detail : `HTTP ${response.status}`;
            console.error("PayMongo API Error:", errorDetail);
            throw new Error(`Could not retrieve payment session details from PayMongo: ${errorDetail}`);
        }
        
        if (!session?.data?.attributes) {
            console.error("Invalid session structure from PayMongo:", session);
            throw new Error('Invalid response structure from payment gateway.');
        }

        const { attributes } = session.data;
        
        // Find a paid payment within the checkout session
        const paidPayment = attributes.payments?.find((p: any) => p.data?.attributes?.status === 'paid');

        if (!paidPayment) {
            await db.query("UPDATE transactions SET status = 'failed' WHERE gateway_transaction_id = ?", [checkoutSessionId]);
            return NextResponse.json({ error: 'Payment was not successful or is still pending.' }, { status: 402 });
        }

        // 2. Extract metadata and verify
        const metadata = attributes.metadata;
        if (!metadata || !metadata.userId || !metadata.courseId || metadata.siteId !== 'external') {
            throw new Error("Payment session metadata is invalid or missing.");
        }
        const { userId, courseId } = metadata;
        
        // 3. Update database
        await db.query('START TRANSACTION');

        // Idempotency check: see if user is already enrolled.
        const [existingEnrollment] = await db.query('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [userId, courseId]);
        
        // Update the transaction from 'pending' to 'completed' regardless.
        await db.query("UPDATE transactions SET status = 'completed' WHERE gateway_transaction_id = ?", [checkoutSessionId]);
        
        if (Array.isArray(existingEnrollment) && existingEnrollment.length > 0) {
            // If already enrolled, just commit the transaction update and return success.
            await db.query('COMMIT');
            return NextResponse.json({ success: true, message: 'Already enrolled.' });
        }
        
        // Enroll the user
        await db.query(
            'INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)',
            [userId, courseId]
        );

        await db.query('COMMIT');

        return NextResponse.json({ success: true, message: 'User enrolled successfully.' });

    } catch (error) {
        await db.query('ROLLBACK').catch(e => console.error("Rollback failed:", e));
        const msg = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to verify payment: ", msg, error);
        return NextResponse.json({
            error: 'Failed to verify payment.',
            details: msg
        }, { status: 500 });
    }
}
