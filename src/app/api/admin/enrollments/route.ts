
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';

const enrollmentSchema = z.object({
  userId: z.number(),
  courseId: z.number(),
});

// Enroll a user in a course
export async function POST(request: NextRequest) {
    try {
        const db = await getDb();
        const data = await request.json();
        const parsedData = enrollmentSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const { userId, courseId } = parsedData.data;
        
        // Ensure the course exists before enrolling
        const course = await db.get('SELECT id FROM courses WHERE id = ?', courseId);
        if (!course) {
            return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
        }

        await db.run(
            'INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)',
            [userId, courseId]
        );
        
        return NextResponse.json({ success: true, message: 'User enrolled successfully.' }, { status: 200 });

    } catch (error) {
        console.error("Failed to enroll user:", error);
        return NextResponse.json({ error: 'Failed to enroll user' }, { status: 500 });
    }
}

// Un-enroll a user from a course
export async function DELETE(request: NextRequest) {
    try {
        const db = await getDb();
        const data = await request.json();
        const parsedData = enrollmentSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }
        
        const { userId, courseId } = parsedData.data;

        // This action only removes the enrollment record.
        // It does NOT delete the user's progress, so if they re-enroll, their progress is maintained.
        await db.run(
            'DELETE FROM enrollments WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );
        
        return NextResponse.json({ success: true, message: 'User un-enrolled successfully.' }, { status: 200 });

    } catch (error) {
        console.error("Failed to un-enroll user:", error);
        return NextResponse.json({ error: 'Failed to un-enroll user' }, { status: 500 });
    }
}
