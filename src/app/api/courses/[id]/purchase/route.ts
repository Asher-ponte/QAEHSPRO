
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';

const purchaseSchema = z.object({
  proofImagePath: z.string().min(1, { message: "Proof of payment image is required." }),
});

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId || user.type !== 'External') {
        return NextResponse.json({ error: 'This action is for external users only.' }, { status: 403 });
    }
    
    if (siteId !== 'external') {
        return NextResponse.json({ error: 'Invalid operation for this site.' }, { status: 400 });
    }
    
    let db;
    try {
        const courseId = parseInt(params.id, 10);
        if (isNaN(courseId)) {
            return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
        }
        
        db = await getDb('external');

        const course = await db.get('SELECT price FROM courses WHERE id = ? AND is_public = 1', courseId);
        if (!course || !course.price || course.price <= 0) {
            return NextResponse.json({ error: 'This is not a paid course or the course was not found.' }, { status: 400 });
        }

        let body;
        try {
            body = await request.json();
        } catch (e) {
            return NextResponse.json({ error: 'Invalid request body. Could not parse JSON.' }, { status: 400 });
        }
        
        const parsedData = purchaseSchema.safeParse(body);
        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input. Proof of payment is required.', details: parsedData.error.flatten() }, { status: 400 });
        }
        const { proofImagePath } = parsedData.data;

        const existingPending = await db.get(
            `SELECT id FROM transactions WHERE user_id = ? AND course_id = ? AND status = 'pending'`,
            [user.id, courseId]
        );
        if (existingPending) {
            return NextResponse.json({ error: 'You already have a pending payment for this course. Please wait for it to be validated.' }, { status: 409 });
        }

        await db.run(
            `INSERT INTO transactions (user_id, course_id, amount, status, transaction_date, proof_image_path)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                user.id,
                courseId,
                course.price,
                'pending',
                new Date().toISOString(),
                proofImagePath,
            ]
        );

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Failed to process purchase submission:", error);
        const details = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to submit payment proof', details }, { status: 500 });
    }
}
