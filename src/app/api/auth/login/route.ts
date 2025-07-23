
'use server'

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { cookies } from 'next/headers'
import { z } from 'zod'
import bcrypt from 'bcrypt';
import type { RowDataPacket } from 'mysql2';

const loginSchema = z.object({
  username: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
})

interface UserWithPassword extends RowDataPacket {
    id: number;
    site_id: string;
    password?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsedData = loginSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Username and Password are required.' }, { status: 400 });
    }

    const { username, password } = parsedData.data;

    const db = await getDb();
    
    // In a multi-tenant setup, the same username can exist across different sites.
    // We need to find all potential matches.
    const [users] = await db.query<UserWithPassword[]>(
      'SELECT id, password, site_id FROM users WHERE username = ?', 
      [username]
    );

    if (users.length === 0) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    let authenticatedUser: UserWithPassword | null = null;
    
    // Iterate through potential users and check password for each.
    for (const user of users) {
        if (user && user.password) {
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (passwordMatch) {
                authenticatedUser = user;
                break; // Found our user
            }
        }
    }

    if (!authenticatedUser) {
        return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    // Set session cookies
    cookies().set('session_id', authenticatedUser.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    cookies().set('site_id', authenticatedUser.site_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });


    return NextResponse.json({ 
      success: true, 
      message: 'Login successful',
      siteId: authenticatedUser.site_id
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
