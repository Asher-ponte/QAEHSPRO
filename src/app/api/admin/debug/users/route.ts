
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const db = await getDb();
        const [users] = await db.query<RowDataPacket[]>(
            `SELECT id, fullName, username FROM users WHERE site_id != 'main' ORDER BY fullName ASC`
        );

        const formattedUsers = users.map(u => ({
            id: u.id,
            name: u.fullName || u.username,
        }));

        return NextResponse.json(formattedUsers);
    } catch (error) {
        console.error("Failed to fetch users for debug:", error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}
