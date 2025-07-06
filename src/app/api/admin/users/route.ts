
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';
import bcrypt from 'bcrypt';
import { SITES } from '@/lib/sites';

const userSchema = z.object({
  fullName: z.string().min(3, { message: "Full name must be at least 3 characters." }),
  username: z.string().min(3, "Username must be at least 3 characters long."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  department: z.string().min(2, "Department must be at least 2 characters long."),
  position: z.string().min(2, "Position must be at least 2 characters long."),
  role: z.enum(["Employee", "Admin"]),
  type: z.enum(["Employee", "External"]),
  siteId: z.string(),
});

export async function GET() {
  const { user, siteId } = await getCurrentSession();
  if (user?.role !== 'Admin' || !siteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const db = await getDb(siteId);
    const users = await db.all('SELECT id, username, fullName, department, position, role, type FROM users ORDER BY username');
    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user: adminUser, siteId: adminSiteId } = await getCurrentSession();
  if (adminUser?.role !== 'Admin' || !adminSiteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    const data = await request.json();
    const parsedData = userSchema.safeParse(data);

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
    }

    const { username, fullName, password, department, position, role, type, siteId } = parsedData.data;

    // Check if the target site is valid
    if (!SITES.some(s => s.id === siteId)) {
        return NextResponse.json({ error: 'Invalid branch specified.' }, { status: 400 });
    }
    
    // Connect to the database of the selected site
    const db = await getDb(siteId);

    // Check for existing username (case-insensitive) in the target database
    const existingUser = await db.get('SELECT id FROM users WHERE username = ? COLLATE NOCASE', username);
    if (existingUser) {
        return NextResponse.json({ error: `Username already exists in the branch '${SITES.find(s => s.id === siteId)?.name}'.` }, { status: 409 });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await db.run(
      'INSERT INTO users (username, password, fullName, department, position, role, type) VALUES (?, ?, ?, ?, ?, ?, ?)', 
      [username, hashedPassword, fullName, department, position, role, type]
    );
    const newUser = await db.get('SELECT id, username, fullName, department, position, role, type FROM users WHERE id = ?', result.lastID);

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
