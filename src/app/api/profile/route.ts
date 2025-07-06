
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';

const profileSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters."),
});

export async function PUT(request: NextRequest) {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    let db;
    try {
        db = await getDb(siteId);
        const data = await request.json();
        const parsedData = profileSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { fullName } = parsedData.data;
        
        await db.run(
            "UPDATE users SET fullName = ? WHERE id = ?",
            [fullName, user.id]
        );

        const updatedUser = await db.get("SELECT id, username, fullName, department, position, role FROM users WHERE id = ?", user.id);

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error("Failed to update profile:", error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
}
