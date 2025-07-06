
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';

const userUpdateSchema = z.object({
  fullName: z.string().min(3, { message: "Full name must be at least 3 characters." }),
  username: z.string().min(3, "Username must be at least 3 characters long."),
  department: z.string().min(2, "Department must be at least 2 characters long."),
  position: z.string().min(2, "Position must be at least 2 characters long."),
  role: z.enum(["Employee", "Admin"]),
  type: z.enum(["Employee", "External"]),
});


export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const { user: sessionUser, siteId } = await getCurrentSession();
    if (sessionUser?.role !== 'Admin' || !siteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const db = await getDb(siteId);
    const { id: userId } = params;

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const user = await db.get('SELECT id, username, fullName, department, position, role, type FROM users WHERE id = ?', userId);
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
    const { user: sessionUser, siteId } = await getCurrentSession();
    if (sessionUser?.role !== 'Admin' || !siteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDb(siteId);
    const { id: userId } = params;

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (parseInt(userId, 10) === 1) {
         return NextResponse.json({ error: 'The Demo User cannot be edited.' }, { status: 403 });
    }

    try {
        const data = await request.json();
        const parsedData = userUpdateSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }

        const { username, fullName, department, position, role, type } = parsedData.data;
        
        const existingUser = await db.get('SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?', [username, userId]);
        if (existingUser) {
            return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
        }

        await db.run(
            'UPDATE users SET username = ?, fullName = ?, department = ?, position = ?, role = ?, type = ? WHERE id = ?',
            [username, fullName, department, position, role, type, userId]
        );
        
        const updatedUser = await db.get('SELECT id, username, fullName, department, position, role, type FROM users WHERE id = ?', userId);
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
    const { user: sessionUser, siteId } = await getCurrentSession();
    if (sessionUser?.role !== 'Admin' || !siteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDb(siteId);
    const { id: userId } = params;

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (parseInt(userId, 10) === 1) {
         return NextResponse.json({ error: 'Cannot delete the default Demo User.' }, { status: 403 });
    }

    try {
        const result = await db.run('DELETE FROM users WHERE id = ?', userId);
        if (result.changes === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, message: `User ${userId} deleted.` });
    } catch (error) {
        console.error(`Failed to delete user ${userId}:`, error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
