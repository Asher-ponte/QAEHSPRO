
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';

const signatorySchema = z.object({
  name: z.string().min(1, "Name is required."),
  position: z.string().min(1, "Position is required."),
  signatureImagePath: z.string().min(1, "Signature image path is required."),
});

export async function GET() {
  const { user } = await getCurrentSession();
  if (!user) { // Any logged in user can view signatories
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const db = await getDb('main'); // Always get from main
    const signatories = await db.all('SELECT * FROM signatories ORDER BY name');
    return NextResponse.json(signatories);
  } catch (error) {
    console.error("Failed to fetch signatories:", error);
    return NextResponse.json({ error: 'Failed to fetch signatories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { isSuperAdmin } = await getCurrentSession();
  if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Super Admin access required.' }, { status: 403 });
  }

  try {
    const db = await getDb('main');
    const data = await request.json();
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
