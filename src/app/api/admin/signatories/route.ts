
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';

const signatorySchema = z.object({
  name: z.string().min(1, "Name is required."),
  signatureImagePath: z.string().min(1, "Signature image path is required."),
});

export async function GET() {
  try {
    const db = await getDb();
    const signatories = await db.all('SELECT * FROM signatories ORDER BY name');
    return NextResponse.json(signatories);
  } catch (error) {
    console.error("Failed to fetch signatories:", error);
    return NextResponse.json({ error: 'Failed to fetch signatories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const data = await request.json();
    const parsedData = signatorySchema.safeParse(data);

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
    }

    const { name, signatureImagePath } = parsedData.data;

    const result = await db.run('INSERT INTO signatories (name, signatureImagePath) VALUES (?, ?)', [name, signatureImagePath]);
    const newSignatory = await db.get('SELECT * FROM signatories WHERE id = ?', result.lastID);

    return NextResponse.json(newSignatory, { status: 201 });
  } catch (error) {
    console.error("Failed to create signatory:", error);
    return NextResponse.json({ error: 'Failed to create signatory' }, { status: 500 });
  }
}
