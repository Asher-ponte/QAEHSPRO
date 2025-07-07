
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';

const purchaseSchema = z.object({
    referenceNumber: z.string().min(1),
    proofImagePath: z.string().min(1),
    amount: z.number().positive(),
});

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId || user.type !== 'External') {
        return NextResponse.json({ error: 'This action is for external users only.' }, { status: 403 });
    }
    
    // Manual payments only happen in the 'external' database context.
    if (siteId !== 'external') {
        return NextResponse.json({ error: 'Invalid operation for this site.' }, { status: 400 });
    }
    
    let db;
    try {
        const courseId = parseInt(params.id, 10);
        if (isNaN(courseId)) {
            return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
        }
        
        const body = await request.json();
        const parsedData = purchaseSchema.safeParse(body);
        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        const { referenceNumber, proofImagePath, amount } = parsedData.data;

        db = await getDb('external');
        
        // Before creating a new pending transaction, check if there's an existing one.
        const existingPending = await db.get(
            `SELECT id FROM transactions WHERE user_id = ? AND course_id = ? AND status = 'pending'`,
            [user.id, courseId]
        );
        if (existingPending) {
            return NextResponse.json({ error: 'You already have a pending payment for this course. Please wait for it to be validated.' }, { status: 409 });
        }

        await db.run(
            `INSERT INTO transactions (user_id, course_id, amount, status, transaction_date, proof_image_path, reference_number)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                user.id,
                courseId,
                amount,
                'pending',
                new Date().toISOString(),
                proofImagePath,
                referenceNumber
            ]
        );

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Failed to process purchase submission:", error);
        const details = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to submit payment proof', details }, { status: 500 });
    }
}
