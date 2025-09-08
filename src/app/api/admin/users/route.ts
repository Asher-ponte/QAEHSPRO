
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';
import { getAllSites } from '@/lib/sites';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const userSchema = z.object({
  fullName: z.string().min(3, { message: "Full name must be at least 3 characters." }),
  username: z.string().min(3, "Username must be at least 3 characters long."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  department: z.string().min(2, "Department must be at least 2 characters long."),
  position: z.string().min(2, "Position must be at least 2 characters long."),
  email: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.enum(["Employee", "Admin"]),
  type: z.enum(["Employee", "External"]),
  siteId: z.string(),
});

export async function GET(request: NextRequest) {
  const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
  if (user?.role !== 'Admin' || !sessionSiteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const requestedSiteId = searchParams.get('siteId');

  try {
    const db = await getDb();
    if (isSuperAdmin) {
      // If a specific site is requested by a super admin, fetch users for that site.
      if (requestedSiteId) {
        const [users] = await db.query<RowDataPacket[]>('SELECT id, username, fullName, department, position, role, type, email, phone FROM users WHERE site_id = ? ORDER BY username', [requestedSiteId]);
        return NextResponse.json(users);
      }

      // Otherwise, super admin gets all users from all branches, excluding 'main'
      const allSites = await getAllSites();
      let allUsers = [];

      for (const site of allSites) {
        // Exclude the 'main' (super admin) site from this management view.
        if (site.id === 'main') continue;
          
        const [siteUsers] = await db.query<RowDataPacket[]>('SELECT id, username, fullName, department, position, role, type, email, phone FROM users WHERE site_id = ? ORDER BY username', [site.id]);
        
        allUsers.push(...(siteUsers as any[]).map(u => ({
          ...u,
          siteId: site.id,
          siteName: site.name,
        })));
      }
      return NextResponse.json(allUsers);
    } else {
      // Branch admin can request users, but ONLY for their own site.
      // We ignore any `requestedSiteId` and force it to their session site.
      const [users] = await db.query<RowDataPacket[]>('SELECT id, username, fullName, department, position, role, type, email, phone FROM users WHERE site_id = ? ORDER BY username', [sessionSiteId]);
      return NextResponse.json(users);
    }
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user: adminUser, siteId: adminSiteId } = await getCurrentSession();
  if (!adminUser || adminUser?.role !== 'Admin' || !adminSiteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    const data = await request.json();
    const parsedData = userSchema.safeParse(data);

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
    }

    const { username, fullName, password, department, position, role, type, siteId, email, phone } = parsedData.data;
    
    // Determine if the calling user is a super admin
    const isSuperAdmin = adminUser.role === 'Admin' && adminSiteId === 'main';

    // Security check: Only Super Admins can create users in a different branch.
    // Client admins can only create users in their own branch.
    if (!isSuperAdmin && siteId !== adminSiteId) {
        return NextResponse.json({ error: 'You do not have permission to create users in other branches.' }, { status: 403 });
    }

    // Check if the target site is valid
    const allSites = await getAllSites();
    if (!allSites.some(s => s.id === siteId)) {
        return NextResponse.json({ error: 'Invalid branch specified.' }, { status: 400 });
    }
    
    // Connect to the database of the selected site
    const db = await getDb();

    // Check for existing username (case-insensitive) in the target database
    const [existingUserRows] = await db.query<RowDataPacket[]>('SELECT id FROM users WHERE username = ? AND site_id = ?', [username, siteId]);
    if (existingUserRows.length > 0) {
        const targetSiteName = allSites.find(s => s.id === siteId)?.name || siteId;
        return NextResponse.json({ error: `Username already exists in the branch '${targetSiteName}'.` }, { status: 409 });
    }

    const [result] = await db.query<ResultSetHeader>(
      'INSERT INTO users (site_id, username, password, fullName, department, position, role, type, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [siteId, username, password, fullName, department, position, role, type, email || null, phone || null]
    );
    const newUserId = result.insertId;

    const [newUserRows] = await db.query<RowDataPacket[]>('SELECT id, username, fullName, department, position, role, type, email, phone FROM users WHERE id = ?', [newUserId]);
    return NextResponse.json(newUserRows[0], { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
