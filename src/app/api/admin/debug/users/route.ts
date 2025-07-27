
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const siteId = request.nextUrl.searchParams.get('siteId');

    try {
        const db = await getDb();

        let query;
        let params: string[] = [];

        if (siteId) {
            query = `SELECT id, fullName, username FROM users WHERE site_id = ? ORDER BY fullName ASC`;
            params.push(siteId);
        } else {
             query = `SELECT id, fullName, username FROM users WHERE site_id != 'main' ORDER BY fullName ASC`;
        }

        const [users] = await db.query<RowDataPacket[]>(query, params);

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
