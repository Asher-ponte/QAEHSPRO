
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { cookies } from 'next/headers'
import { z } from 'zod'
import bcrypt from 'bcrypt';
import { SITES } from '@/lib/sites';

const registerSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters."),
  username: z.string().min(3, "Username must be at least 3 characters."),
  password: z.string().min(6, "Password must be at least 6 characters."),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsedData = registerSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input.', details: parsedData.error.flatten() }, { status: 400 });
    }

    const { fullName, username, password } = parsedData.data;

    // External users are always created in the 'main' site database
    const siteId = 'main';
    if (!SITES.some(s => s.id === siteId)) {
        return NextResponse.json({ error: 'The main site is not configured correctly.' }, { status: 500 });
    }

    const db = await getDb(siteId);

    // Check if username already exists
    const existingUser = await db.get('SELECT id FROM users WHERE username = ? COLLATE NOCASE', username);
    if (existingUser) {
        return NextResponse.json({ error: 'Username already exists.' }, { status: 409 });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create the user
    const result = await db.run(
        `INSERT INTO users (username, password, fullName, department, position, role, type) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [username, hashedPassword, fullName, null, null, 'Employee', 'External']
    );

    const newUserId = result.lastID;
    if (!newUserId) {
        throw new Error("Failed to create user record.");
    }
    
    // Automatically log the user in by setting session cookies
    cookies().set('session_id', newUserId.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    cookies().set('site_id', siteId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return NextResponse.json({ success: true, message: 'Registration successful' });

  } catch (error) {
    console.error('Registration error:', error);
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
