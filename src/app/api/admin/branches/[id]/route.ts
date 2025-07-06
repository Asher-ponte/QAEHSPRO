
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';
import { CORE_SITES } from '@/lib/sites';
import fs from 'fs/promises';
import path from 'path';

const editBranchSchema = z.object({
  name: z.string().min(3, "Branch name must be at least 3 characters."),
});

async function checkPermissions(branchId: string) {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return { authorized: false, error: 'Unauthorized: Super Admin access required', status: 403 };
    }

    const isCoreSite = CORE_SITES.some(site => site.id === branchId);
    if (isCoreSite) {
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

    const mainDb = await getDb('main');
    
    try {
        const data = await request.json();
        const parsedData = editBranchSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { name } = parsedData.data;

        // Check if the new name conflicts with another existing branch name.
        const existingName = await mainDb.get('SELECT * FROM custom_sites WHERE name = ? AND id != ?', [name, id]);
        if (existingName) {
            return NextResponse.json({ error: 'A branch with this name already exists.' }, { status: 409 });
        }

        await mainDb.run('UPDATE custom_sites SET name = ? WHERE id = ?', [name, id]);

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

    const mainDb = await getDb('main');

    try {
        const result = await mainDb.run('DELETE FROM custom_sites WHERE id = ?', id);
        if (result.changes === 0) {
            return NextResponse.json({ error: 'Branch not found or already deleted' }, { status: 404 });
        }

        // After successfully deleting from the database, delete the file.
        const dbPath = path.join(process.cwd(), 'data', `${id}.sqlite`);
        await fs.unlink(dbPath).catch(err => {
            // Log the error but don't fail the request if the file was already gone.
            console.warn(`Could not delete database file for branch '${id}'. It might have been already removed. Error: ${err.message}`);
        });

        return NextResponse.json({ success: true, message: `Branch '${id}' deleted successfully.` });

    } catch (error) {
        console.error("Failed to delete branch:", error);
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: 'Failed to delete branch', details }, { status: 500 });
    }
}
