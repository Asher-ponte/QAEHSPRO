
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export async function DELETE(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const db = await getDb();
    const { id } = params;

    if (!id) {
        return NextResponse.json({ error: 'Signatory ID is required' }, { status: 400 });
    }

    try {
        const result = await db.run('DELETE FROM signatories WHERE id = ?', id);
        if (result.changes === 0) {
            return NextResponse.json({ error: 'Signatory not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, message: `Signatory ${id} deleted.` });
    } catch (error) {
        console.error(`Failed to delete signatory ${id}:`, error);
        return NextResponse.json({ error: 'Failed to delete signatory' }, { status: 500 });
    }
}
