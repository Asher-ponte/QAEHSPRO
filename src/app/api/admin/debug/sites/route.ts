
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const db = await getDb();
        const [sites] = await db.query<RowDataPacket[]>(
            `SELECT id, name FROM sites WHERE id NOT IN ('main', 'external') ORDER BY name ASC`
        );
        
        const formattedSites = sites.map(s => ({
            id: s.id,
            name: s.name,
        }));

        return NextResponse.json(formattedSites);
    } catch (error) {
        console.error("Failed to fetch sites for debug:", error);
        return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
    }
}
