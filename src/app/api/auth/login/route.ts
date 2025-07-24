
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
    role: string;
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
    
    // Step 1: Find all users with the given username. In a multi-tenant system,
    // the same username might exist for different sites.
    const [users] = await db.query<UserWithPassword[]>(
      'SELECT id, password, site_id, role FROM users WHERE username = ?', 
      [username]
    );

    if (users.length === 0) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    // Step 2: Since usernames are unique per site, we might have multiple.
    // We need to find the one where the password matches.
    let authenticatedUser: UserWithPassword | null = null;
    for (const user of users) {
        if (user && user.password) {
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (passwordMatch) {
                authenticatedUser = user;
                break; // Found our user, exit the loop.
            }
        }
    }
    
    if (!authenticatedUser) {
        return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }
    
    // Step 3: Set session cookies.
    cookies().set('session_id', authenticatedUser.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    
    // The `site_id` cookie determines which "tenant" the user is viewing.
    // For a super admin ('main' site), they start by viewing their own 'main' dashboard.
    // For any other user, they are scoped to their own site.
    cookies().set('site_id', authenticatedUser.site_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Login successful',
      siteId: authenticatedUser.site_id // Return siteId to help client-side routing if needed
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
