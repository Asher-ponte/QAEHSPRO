
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
        if (!course) {
            return NextResponse.json({ error: 'Course not found or is not public.' }, { status: 404 });
        }
        
        const coursePrice = course ? parseFloat(course.price) : 0;
        if (coursePrice === undefined || coursePrice < 0) {
            return NextResponse.json({ error: 'This course does not have a valid price.' }, { status: 400 });
        }

        const body = await request.json();
        
        const parsedData = purchaseSchema.safeParse(body);
        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input. Proof of payment is required.', details: parsedData.error.flatten() }, { status: 400 });
        }
        const { proofImagePath } = parsedData.data;

        await db.run('BEGIN TRANSACTION');

        const existingPending = await db.get(
            `SELECT id FROM transactions WHERE user_id = ? AND course_id = ? AND status IN ('pending', 'completed')`,
            [user.id, courseId]
        );
        if (existingPending) {
            await db.run('ROLLBACK');
            return NextResponse.json({ error: 'You already have a pending or completed payment for this course.' }, { status: 409 });
        }

        // Create the transaction record
        await db.run(
            `INSERT INTO transactions (user_id, course_id, amount, status, transaction_date, proof_image_path, gateway)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                user.id,
                courseId,
                coursePrice,
                'pending',
                new Date().toISOString(),
                proofImagePath,
                'manual_upload'
            ]
        );

        // Enroll the user immediately so they can start the course.
        await db.run(
            'INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)',
            [user.id, courseId]
        );
        
        await db.run('COMMIT');

        return NextResponse.json({ success: true, message: "Payment submitted and course unlocked." });

    } catch (error) {
        if (db) await db.run('ROLLBACK').catch(console.error);
        const details = error instanceof Error ? error.message : 'Unknown server error';
        console.error("Purchase API: CATCH BLOCK ERROR:", { error: details, stack: (error as Error).stack });
        return NextResponse.json({ error: 'Failed to submit payment proof due to a server error.', details }, { status: 500 });
    }
}

    