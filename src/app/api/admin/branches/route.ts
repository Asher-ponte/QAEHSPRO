
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';
import { getAllSites } from '@/lib/sites';
import type { ResultSetHeader } from 'mysql2';

const createBranchSchema = z.object({
  name: z.string().min(3, "Branch name must be at least 3 characters."),
});

// A simple slugify function
const slugify = (text: string): string => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')       // Replace spaces with -
        .replace(/[^\w\-]+/g, '')   // Remove all non-word chars
        .replace(/\-\-+/g, '-');      // Replace multiple - with single -
}

export async function POST(request: NextRequest) {
    const { user: adminUser, isSuperAdmin } = await getCurrentSession();
    if (!adminUser || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
    }

    try {
        const data = await request.json();
        const parsedData = createBranchSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { name } = parsedData.data;
        const id = slugify(name);

        if (!id) {
            return NextResponse.json({ error: 'Could not generate a valid ID from the branch name.' }, { status: 400 });
        }
        
        const allSites = await getAllSites();
        if (allSites.some(site => site.id === id || site.name.toLowerCase() === name.toLowerCase())) {
            return NextResponse.json({ error: 'A branch with this name or a similar ID already exists.' }, { status: 409 });
        }

        const db = await getDb();

        const [result] = await db.query<ResultSetHeader>(
            'INSERT INTO sites (id, name) VALUES (?, ?)',
            [id, name]
        );

        if (result.affectedRows === 0) {
            throw new Error("Failed to create the new site record.");
        }
        
        return NextResponse.json({ success: true, newBranch: { id, name } }, { status: 201 });

    } catch (error) {
        console.error("Failed to create new branch:", error);
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: 'Failed to create branch', details }, { status: 500 });
    }
}
