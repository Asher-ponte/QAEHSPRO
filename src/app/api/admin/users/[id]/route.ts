
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';

const userUpdateSchema = z.object({
  fullName: z.string().min(3, { message: "Full name must be at least 3 characters." }),
  username: z.string().min(3, "Username must be at least 3 characters long."),
  password: z.string().min(6, "Password must be at least 6 characters.").optional().or(z.literal('')),
  department: z.string().min(2, "Department must be at least 2 characters long."),
  position: z.string().min(2, "Position must be at least 2 characters long."),
  email: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.enum(["Employee", "Admin"]),
  type: z.enum(["Employee", "External"]),
});

async function getEffectiveSiteId(request: NextRequest): Promise<string | null> {
    const { user: sessionUser, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (sessionUser?.role !== 'Admin' || !sessionSiteId) return null;

    let effectiveSiteId = sessionSiteId;
    if (isSuperAdmin) {
        const url = new URL(request.url);
        const targetSiteId = url.searchParams.get('siteId');
        if (targetSiteId) {
            effectiveSiteId = targetSiteId;
        }
    }
    return effectiveSiteId;
}

export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const effectiveSiteId = await getEffectiveSiteId(request);
    if (!effectiveSiteId) {
        return NextResponse.json({ error: 'Unauthorized or invalid site context' }, { status: 403 });
    }
    
    const db = await getDb();
    const { id: userId } = params;

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const [[user]] = await db.query('SELECT id, username, fullName, department, position, role, type, email, phone FROM users WHERE id = ? AND site_id = ?', [userId, effectiveSiteId]);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        return NextResponse.json(user);
    } catch (error) {
        console.error(`Failed to fetch user ${userId}:`, error);
        return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const effectiveSiteId = await getEffectiveSiteId(request);
     if (!effectiveSiteId) {
        return NextResponse.json({ error: 'Unauthorized or invalid site context' }, { status: 403 });
    }

    const { id: userId } = params;

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const db = await getDb();
    
    // Globally protected user
    const [[userToEdit]]: any = await db.query('SELECT username from users WHERE id = ? AND site_id = ?', [userId, effectiveSiteId]);
    if (userToEdit?.username === 'florante') {
         return NextResponse.json({ error: 'The Super Admin user cannot be edited.' }, { status: 403 });
    }

    try {
        const data = await request.json();
        const parsedData = userUpdateSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }

        const { username, fullName, password, department, position, role, type, email, phone } = parsedData.data;
        
        const [existingUser]: any = await db.query('SELECT id FROM users WHERE username = ? AND site_id = ? AND id != ?', [username, effectiveSiteId, userId]);
        if (existingUser.length > 0) {
            return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
        }

        if (password) {
            await db.query(
                'UPDATE users SET username = ?, fullName = ?, password = ?, department = ?, position = ?, role = ?, type = ?, email = ?, phone = ? WHERE id = ? AND site_id = ?',
                [username, fullName, password, department, position, role, type, email || null, phone || null, userId, effectiveSiteId]
            );
        } else {
            await db.query(
                'UPDATE users SET username = ?, fullName = ?, department = ?, position = ?, role = ?, type = ?, email = ?, phone = ? WHERE id = ? AND site_id = ?',
                [username, fullName, department, position, role, type, email || null, phone || null, userId, effectiveSiteId]
            );
        }
        
        const [[updatedUser]] = await db.query('SELECT id, username, fullName, department, position, role, type, email, phone FROM users WHERE id = ?', userId);
        return NextResponse.json(updatedUser, { status: 200 });

    } catch (error) {
        console.error(`Failed to update user ${userId}:`, error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}


export async function DELETE(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const effectiveSiteId = await getEffectiveSiteId(request);
     if (!effectiveSiteId) {
        return NextResponse.json({ error: 'Unauthorized or invalid site context' }, { status: 403 });
    }
    
    const { id: userId } = params;

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const db = await getDb();

    const [[userToDelete]]: any = await db.query('SELECT username from users WHERE id = ? AND site_id = ?', [userId, effectiveSiteId]);
    if (userToDelete?.username === 'florante') {
         return NextResponse.json({ error: 'The Super Admin user cannot be deleted.' }, { status: 403 });
    }

    try {
        const [result]: any = await db.query('DELETE FROM users WHERE id = ? AND site_id = ?', [userId, effectiveSiteId]);
        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, message: `User ${userId} deleted.` });
    } catch (error) {
        console.error(`Failed to delete user ${userId}:`, error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
