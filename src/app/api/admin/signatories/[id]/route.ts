
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import { getAllSites } from '@/lib/sites';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const signatoryUpdateSchema = z.object({
  name: z.string().min(1, "Name is required."),
  position: z.string().min(1, "Position is required."),
  signatureImagePath: z.string().min(1, "Signature image is required."),
});

async function checkPermissions(siteId: string | null) {
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (!user || user.role !== 'Admin') {
        return { authorized: false, error: 'Unauthorized', status: 403, effectiveSiteId: null };
    }
    
    if (isSuperAdmin) {
        if (!siteId) return { authorized: false, error: 'siteId is required for super admin', status: 400, effectiveSiteId: null };
        const allSites = await getAllSites();
        if (!allSites.some(s => s.id === siteId)) {
            return { authorized: false, error: 'Invalid site specified', status: 400, effectiveSiteId: null };
        }
        return { authorized: true, effectiveSiteId: siteId };
    } else {
        // Client admin can only operate on their own site
        return { authorized: true, effectiveSiteId: sessionSiteId };
    }
}

export async function PUT(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    const permCheck = await checkPermissions(siteId);
    if (!permCheck.authorized || !permCheck.effectiveSiteId) {
        return NextResponse.json({ error: permCheck.error }, { status: permCheck.status as number });
    }

    const db = await getDb();
    const { id } = params;

    if (!id) {
        return NextResponse.json({ error: 'Signatory ID is required' }, { status: 400 });
    }
    
    try {
        const data = await request.json();
        const parsedData = signatoryUpdateSchema.safeParse(data);
        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        const { name, position, signatureImagePath } = parsedData.data;

        await db.query(
            'UPDATE signatories SET name = ?, position = ?, signatureImagePath = ? WHERE id = ? AND site_id = ?',
            [name, position, signatureImagePath, id, permCheck.effectiveSiteId]
        );

        const [updatedSignatoryRows] = await db.query<RowDataPacket[]>('SELECT * FROM signatories WHERE id = ?', [id]);
        return NextResponse.json(updatedSignatoryRows[0]);
    } catch (error) {
        console.error(`Failed to update signatory ${id}:`, error);
        return NextResponse.json({ error: 'Failed to update signatory' }, { status: 500 });
    }
}


export async function DELETE(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    const permCheck = await checkPermissions(siteId);
    if (!permCheck.authorized || !permCheck.effectiveSiteId) {
        return NextResponse.json({ error: permCheck.error }, { status: permCheck.status as number });
    }
    
    const db = await getDb();
    const { id } = params;

    if (!id) {
        return NextResponse.json({ error: 'Signatory ID is required' }, { status: 400 });
    }

    try {
        await db.query('DELETE FROM certificate_signatories WHERE signatory_id = ?', [id]);
        const [result] = await db.query<ResultSetHeader>('DELETE FROM signatories WHERE id = ? AND site_id = ?', [id, permCheck.effectiveSiteId]);
        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'Signatory not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, message: `Signatory ${id} deleted.` });
    } catch (error) {
        console.error(`Failed to delete signatory ${id}:`, error);
        return NextResponse.json({ error: 'Failed to delete signatory' }, { status: 500 });
    }
}
