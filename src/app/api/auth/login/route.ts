
'use server'

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { cookies } from 'next/headers'
import { z } from 'zod'
import bcrypt from 'bcrypt';

const loginSchema = z.object({
  username: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsedData = loginSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Username and Password are required.' }, { status: 400 });
    }

    const { username, password } = parsedData.data;

    const db = await getDb();
    // In a single-DB setup, we can just search for the user directly across all sites.
    const [rows]: any = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    
    let loggedInUser = null;
    let siteIdOfUser = null;

    // Iterate through potential matches (in case of same username across sites, though this should be rare)
    for (const user of rows) {
       if (user && user.password) {
            try {
                const passwordMatch = await bcrypt.compare(password, user.password);
                if (passwordMatch) {
                    loggedInUser = user;
                    siteIdOfUser = user.site_id;
                    break; // Exit loop once user is found and authenticated
                }
            } catch (e) {
                 console.warn(`Bcrypt error for user '${username}'. Hash might be invalid. Skipping. Error: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }


    if (!loggedInUser || !siteIdOfUser) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    // Set session cookies
    cookies().set('session_id', loggedInUser.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    cookies().set('site_id', siteIdOfUser, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });


    return NextResponse.json({ 
      success: true, 
      message: 'Login successful',
      siteId: siteIdOfUser 
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
