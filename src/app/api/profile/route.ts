
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';

const profileSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters."),
});

export async function PUT(request: NextRequest) {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    try {
        const db = await getDb();
        const data = await request.json();
        const parsedData = profileSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { fullName } = parsedData.data;
        
        await db.query(
            "UPDATE users SET fullName = ? WHERE id = ? AND site_id = ?",
            [fullName, user.id, siteId]
        );

        const [updatedUserRows] = await db.query<RowDataPacket[]>("SELECT id, username, fullName, department, position, role FROM users WHERE id = ?", user.id);
        const updatedUser = updatedUserRows[0];

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error("Failed to update profile:", error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
}
