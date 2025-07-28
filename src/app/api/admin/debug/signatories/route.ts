
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
    if (!siteId) {
        return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }

    try {
        const db = await getDb();
        const [signatories] = await db.query<RowDataPacket[]>(
            `SELECT id, name, position FROM signatories WHERE site_id = ? ORDER BY name ASC`,
            [siteId]
        );
        
        const formattedSignatories = signatories.map(s => ({
            id: s.id,
            name: s.name,
        }));
        
        return NextResponse.json(formattedSignatories);
    } catch (error) {
        console.error("Failed to fetch signatories for debug:", error);
        return NextResponse.json({ error: 'Failed to fetch signatories' }, { status: 500 });
    }
}
