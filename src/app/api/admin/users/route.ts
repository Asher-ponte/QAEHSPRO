import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';

const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long."),
});

export async function GET() {
  try {
    const db = await getDb();
    const users = await db.all('SELECT id, username FROM users ORDER BY username');
    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const data = await request.json();
    const parsedData = userSchema.safeParse(data);

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
    }

    const { username } = parsedData.data;

    // Check for existing username
    const existingUser = await db.get('SELECT id FROM users WHERE username = ?', username);
    if (existingUser) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    const result = await db.run('INSERT INTO users (username) VALUES (?)', username);
    const newUser = await db.get('SELECT id, username FROM users WHERE id = ?', result.lastID);

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
