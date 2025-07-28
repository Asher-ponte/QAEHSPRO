
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';

const profileSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters."),
  email: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')),
  phone: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(data => {
    // If one password field is filled, all should be
    if (data.newPassword || data.confirmPassword || data.currentPassword) {
        return data.newPassword && data.confirmPassword && data.currentPassword;
    }
    return true;
}, {
    message: "Please fill all password fields to change your password.",
    path: ["currentPassword"], // Show error on the first field
}).refine(data => {
    if (data.newPassword && data.newPassword.length < 6) {
        return false;
    }
    return true;
}, {
    message: "New password must be at least 6 characters.",
    path: ["newPassword"],
}).refine(data => data.newPassword === data.confirmPassword, {
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
        
        const { fullName, email, phone, currentPassword, newPassword } = parsedData.data;
        
        // Update editable fields
        await db.query(
            "UPDATE users SET fullName = ?, email = ?, phone = ? WHERE id = ? AND site_id = ?",
            [fullName, email || null, phone || null, user.id, siteId]
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
