
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { SITES } from '@/lib/sites';
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

    let loggedInUser = null;
    let loggedInSiteId = null;

    // Iterate over all sites to find the user
    for (const site of SITES) {
        const db = await getDb(site.id);
        const user = await db.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', username);

        if (user && user.password) {
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (passwordMatch) {
                loggedInUser = user;
                loggedInSiteId = site.id;
                break; // Exit loop once user is found and authenticated
            }
        }
    }

    if (!loggedInUser || !loggedInSiteId) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    // Set session cookies
    cookies().set('session_id', loggedInUser.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    cookies().set('site_id', loggedInSiteId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });


    return NextResponse.json({ success: true, message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
