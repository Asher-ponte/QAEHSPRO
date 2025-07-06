
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
    
    if (user.type !== 'External') {
        return NextResponse.json({ error: 'This action is for external users only.' }, { status: 403 });
    }
    
    const userDb = await getDb(siteId); // User's own DB ('external')
    const mainDb = await getDb('main'); // Course data lives in 'main' DB
    
    try {
        const courseId = parseInt(params.id, 10);
        if (isNaN(courseId)) {
            return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
        }

        const course = await mainDb.get('SELECT * FROM courses WHERE id = ? AND is_public = 1', courseId);
        if (!course) {
            return NextResponse.json({ error: 'Paid course not found.' }, { status: 404 });
        }
        
        if (!course.price || course.price <= 0) {
             return NextResponse.json({ error: 'This is not a paid course.' }, { status: 400 });
        }

        const existingEnrollment = await userDb.get('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?', [user.id, courseId]);
        if (existingEnrollment) {
            return NextResponse.json({ error: 'You are already enrolled in this course.' }, { status: 409 });
        }

        await userDb.run('BEGIN TRANSACTION');

        // Create a mock transaction record in the user's DB.
        const transactionResult = await userDb.run(
            `INSERT INTO transactions (user_id, course_id, amount, status, transaction_date, gateway, gateway_transaction_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                user.id,
                courseId,
                course.price,
                'completed',
                new Date().toISOString(),
                'mock_gateway',
                `mock_${Date.now()}`
            ]
        );
        
        if (!transactionResult.lastID) {
            throw new Error("Failed to create transaction record.");
        }

        // Enroll the user in the course in their DB.
        await userDb.run(
            'INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)',
            [user.id, courseId]
        );

        await userDb.run('COMMIT');

        return NextResponse.json({ success: true, message: 'Purchase successful, you are now enrolled.' });

    } catch (error) {
        await userDb.run('ROLLBACK').catch(console.error);
        console.error("Failed to process mock purchase:", error);
        const details = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to complete purchase', details }, { status: 500 });
    }
}
