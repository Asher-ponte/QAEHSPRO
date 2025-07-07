
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    if (user.type !== 'External' || siteId !== 'external') {
        return NextResponse.json({ error: 'This action is for external users only.' }, { status: 403 });
    }
    
    const { PAYMONGO_SECRET_KEY, NEXT_PUBLIC_APP_URL } = process.env;
    if (!PAYMONGO_SECRET_KEY || !NEXT_PUBLIC_APP_URL) {
        console.error("Payment gateway environment variables are not set.");
        return NextResponse.json({ error: 'Payment gateway is not configured. Please set PAYMONGO_SECRET_KEY and NEXT_PUBLIC_APP_URL in your environment.' }, { status: 500 });
    }
    
    const db = await getDb(siteId);
    
    try {
        const courseId = parseInt(params.id, 10);
        if (isNaN(courseId)) {
            return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
        }

        const course = await db.get('SELECT * FROM courses WHERE id = ? AND is_public = 1', courseId);
        if (!course) {
            return NextResponse.json({ error: 'Paid course not found.' }, { status: 404 });
        }
        
        if (!course.price || course.price <= 0) {
             return NextResponse.json({ error: 'This is not a paid course.' }, { status: 400 });
        }
        
        const existingEnrollment = await db.get('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?', [user.id, courseId]);
        if (existingEnrollment) {
            return NextResponse.json({ error: 'You are already enrolled in this course.' }, { status: 409 });
        }

        const amountInCentavos = Math.round(course.price * 100);

        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY).toString('base64')}`
            },
            body: JSON.stringify({
                data: {
                    attributes: {
                        line_items: [
                            {
                                currency: 'PHP',
                                amount: amountInCentavos,
                                name: course.title,
                                quantity: 1,
                            }
                        ],
                        payment_method_types: ['card', 'gcash', 'paymaya', 'grab_pay'],
                        success_url: `${NEXT_PUBLIC_APP_URL}/courses/${courseId}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
                        cancel_url: `${NEXT_PUBLIC_APP_URL}/courses/${courseId}`,
                        description: `Payment for course: ${course.title}`,
                        metadata: {
                            userId: user.id,
                            courseId: course.id,
                            siteId: siteId
                        }
                    }
                }
            })
        };

        const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', options);
        const checkoutSession = await response.json();

        if (!response.ok || checkoutSession.errors) {
            console.error("PayMongo Error:", checkoutSession.errors);
            throw new Error('Failed to create payment session.');
        }

        // Before sending the URL, create a PENDING transaction record.
        await db.run(
            `INSERT INTO transactions (user_id, course_id, amount, status, transaction_date, gateway, gateway_transaction_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                user.id,
                courseId,
                course.price,
                'pending',
                new Date().toISOString(),
                'paymongo',
                checkoutSession.data.id
            ]
        );

        return NextResponse.json({ checkoutUrl: checkoutSession.data.attributes.checkout_url });

    } catch (error) {
        console.error("Failed to process purchase:", error);
        const details = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to create payment link', details }, { status: 500 });
    }
}
