
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const editBranchSchema = z.object({
  name: z.string().min(3, "Branch name must be at least 3 characters."),
});

async function checkPermissions(branchId: string) {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return { authorized: false, error: 'Unauthorized: Super Admin access required', status: 403 };
    }
    
    // Core site IDs that cannot be modified.
    const coreSiteIds = ['main', 'external'];
    if (coreSiteIds.includes(branchId)) {
        return { authorized: false, error: 'Core branches cannot be modified or deleted.', status: 403 };
    }

    return { authorized: true };
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const { id } = params;
    const permCheck = await checkPermissions(id);
    if (!permCheck.authorized) {
        return NextResponse.json({ error: permCheck.error }, { status: permCheck.status as number });
    }

    const db = await getDb();
    
    try {
        const data = await request.json();
        const parsedData = editBranchSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { name } = parsedData.data;

        // Check if the new name conflicts with another existing branch name.
        const [existingNameRows] = await db.query<RowDataPacket[]>('SELECT * FROM sites WHERE name = ? AND id != ?', [name, id]);
        if (existingNameRows.length > 0) {
            return NextResponse.json({ error: 'A branch with this name already exists.' }, { status: 409 });
        }

        await db.query('UPDATE sites SET name = ? WHERE id = ?', [name, id]);

        return NextResponse.json({ success: true, updatedBranch: { id, name } });

    } catch (error) {
        console.error("Failed to update branch:", error);
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: 'Failed to update branch', details }, { status: 500 });
    }
}


export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    const { id } = params;
    const permCheck = await checkPermissions(id);
    if (!permCheck.authorized) {
        return NextResponse.json({ error: permCheck.error }, { status: permCheck.status as number });
    }

    const db = await getDb();

    try {
        const [result] = await db.query<ResultSetHeader>('DELETE FROM sites WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'Branch not found or already deleted' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: `Branch '${id}' deleted successfully.` });

    } catch (error) {
        console.error("Failed to delete branch:", error);
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: 'Failed to delete branch', details }, { status: 500 });
    }
}
