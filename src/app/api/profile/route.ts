
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';

const profileSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters."),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(data => {
    if (data.newPassword || data.currentPassword || data.confirmPassword) {
        return data.newPassword === data.confirmPassword;
    }
    return true;
}, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
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
        
        const { fullName, currentPassword, newPassword } = parsedData.data;
        
        // Update full name
        await db.query(
            "UPDATE users SET fullName = ? WHERE id = ? AND site_id = ?",
            [fullName, user.id, siteId]
        );
        
        // Conditionally update password
        if (newPassword && currentPassword) {
            const [userRows] = await db.query<RowDataPacket & { password?: string }[]>(
                "SELECT password FROM users WHERE id = ?",
                [user.id]
            );
            const userWithPassword = userRows[0];

            if (!userWithPassword || userWithPassword.password !== currentPassword) {
                return NextResponse.json({ error: 'Incorrect current password.' }, { status: 403 });
            }

            await db.query(
                "UPDATE users SET password = ? WHERE id = ?",
                [newPassword, user.id]
            );
        }

        const [updatedUserRows] = await db.query<RowDataPacket[]>("SELECT id, username, fullName, department, position, role, type, email, phone FROM users WHERE id = ?", user.id);
        const updatedUser = updatedUserRows[0];

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error("Failed to update profile:", error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
}
