
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';

const userSchema = z.object({
  fullName: z.string().min(3, { message: "Full name must be at least 3 characters." }),
  username: z.string().min(3, "Username must be at least 3 characters long."),
  department: z.string().min(2, "Department must be at least 2 characters long."),
  position: z.string().min(2, "Position must be at least 2 characters long."),
  role: z.enum(["Employee", "Admin"]),
});

export async function GET() {
  const { user, siteId } = await getCurrentSession();
  if (user?.role !== 'Admin' || !siteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const db = await getDb(siteId);
    const users = await db.all('SELECT id, username, fullName, department, position, role FROM users ORDER BY username');
    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, siteId } = await getCurrentSession();
  if (user?.role !== 'Admin' || !siteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    const db = await getDb(siteId);
    const data = await request.json();
    const parsedData = userSchema.safeParse(data);

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
    }

    const { username, fullName, department, position, role } = parsedData.data;

    // Check for existing username (case-insensitive)
    const existingUser = await db.get('SELECT id FROM users WHERE username = ? COLLATE NOCASE', username);
    if (existingUser) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    const result = await db.run(
      'INSERT INTO users (username, fullName, department, position, role) VALUES (?, ?, ?, ?, ?)', 
      [username, fullName, department, position, role]
    );
    const newUser = await db.get('SELECT id, username, fullName, department, position, role FROM users WHERE id = ?', result.lastID);

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
