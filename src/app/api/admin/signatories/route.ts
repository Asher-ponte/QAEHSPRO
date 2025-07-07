
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';
import { getAllSites } from '@/lib/sites';

const signatorySchema = z.object({
  name: z.string().min(1, "Name is required."),
  position: z.string().min(1, "Position is required."),
  signatureImagePath: z.string().min(1, "Signature image is required."),
  siteId: z.string()
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

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('siteId');
  const permCheck = await checkPermissions(siteId);

  if (!permCheck.authorized) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status as number });
  }

  try {
    const db = await getDb(permCheck.effectiveSiteId!);
    const signatories = await db.all('SELECT * FROM signatories ORDER BY name');
    return NextResponse.json(signatories);
  } catch (error) {
    console.error("Failed to fetch signatories:", error);
    return NextResponse.json({ error: 'Failed to fetch signatories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const permCheck = await checkPermissions(data.siteId);
  if (!permCheck.authorized) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status as number });
  }

  try {
    const db = await getDb(permCheck.effectiveSiteId!);
    const parsedData = signatorySchema.safeParse(data);

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
    }

    const { name, position, signatureImagePath } = parsedData.data;

    const result = await db.run('INSERT INTO signatories (name, position, signatureImagePath) VALUES (?, ?, ?)', [name, position, signatureImagePath]);
    const newSignatory = await db.get('SELECT * FROM signatories WHERE id = ?', result.lastID);

    return NextResponse.json(newSignatory, { status: 201 });
  } catch (error) {
    console.error("Failed to create signatory:", error);
    return NextResponse.json({ error: 'Failed to create signatory' }, { status: 500 });
  }
}
