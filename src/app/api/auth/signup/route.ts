import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const signupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const data = await request.json();

    const parsedData = signupSchema.safeParse(data);

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsedData.error.errors }, { status: 400 });
    }

    const { username, password } = parsedData.data;

    const existingUser = await db.get('SELECT * FROM users WHERE username = ?', username);
    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);

    if (!result.lastID) {
        throw new Error('Failed to create user');
    }

    return NextResponse.json({ message: 'User created successfully' }, { status: 201 });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
