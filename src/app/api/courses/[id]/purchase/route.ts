
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
    console.log("Purchase API hit");
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId || user.type !== 'External') {
        console.error("Purchase API: Auth check failed.", { userId: user?.id, siteId, userType: user?.type });
        return NextResponse.json({ error: 'This action is for external users only.' }, { status: 403 });
    }
    
    if (siteId !== 'external') {
        console.error("Purchase API: Site ID is not 'external'.", { siteId });
        return NextResponse.json({ error: 'Invalid operation for this site.' }, { status: 400 });
    }
    
    let db;
    try {
        const courseId = parseInt(params.id, 10);
        if (isNaN(courseId)) {
            console.error("Purchase API: Invalid course ID.", { courseId: params.id });
            return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
        }
        
        console.log(`Purchase API: Processing for courseId: ${courseId}, userId: ${user.id}`);

        db = await getDb('external');

        const course = await db.get('SELECT price FROM courses WHERE id = ? AND is_public = 1', courseId);
        if (!course) {
            console.error("Purchase API: Course not found in DB.", { courseId });
            return NextResponse.json({ error: 'Course not found or is not public.' }, { status: 404 });
        }
        if (!course.price || course.price <= 0) {
            console.error("Purchase API: Course is not a paid course.", { courseId, price: course.price });
            return NextResponse.json({ error: 'This is not a paid course.' }, { status: 400 });
        }

        let body;
        try {
            body = await request.json();
        } catch (e) {
            console.error("Purchase API: Failed to parse JSON body.", e);
            return NextResponse.json({ error: 'Invalid request body. Could not parse JSON.' }, { status: 400 });
        }
        
        const parsedData = purchaseSchema.safeParse(body);
        if (!parsedData.success) {
            console.error("Purchase API: Zod validation failed.", parsedData.error);
            return NextResponse.json({ error: 'Invalid input. Proof of payment is required.', details: parsedData.error.flatten() }, { status: 400 });
        }
        const { proofImagePath } = parsedData.data;
        console.log("Purchase API: Received proofImagePath:", proofImagePath);

        const existingPending = await db.get(
            `SELECT id FROM transactions WHERE user_id = ? AND course_id = ? AND status = 'pending'`,
            [user.id, courseId]
        );
        if (existingPending) {
            console.warn("Purchase API: User already has a pending payment.", { userId: user.id, courseId });
            return NextResponse.json({ error: 'You already have a pending payment for this course. Please wait for it to be validated.' }, { status: 409 });
        }

        console.log("Purchase API: Inserting transaction into DB...");
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
        console.log("Purchase API: Transaction inserted successfully.");

        return NextResponse.json({ success: true });

    } catch (error) {
        const details = error instanceof Error ? error.message : 'Unknown server error';
        console.error("Purchase API: CATCH BLOCK ERROR:", { error: details, stack: (error as Error).stack });
        return NextResponse.json({ error: 'Failed to submit payment proof due to a server error.', details }, { status: 500 });
    }
}
