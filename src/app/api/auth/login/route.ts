
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { getAllSites } from '@/lib/sites';
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

    const allSites = await getAllSites();
    
    // Create a specific search order. Non-main sites first, then 'main' is checked last.
    // This prevents a branch user with the same credentials as a super admin from
    // incorrectly getting super admin privileges.
    const sortedSites = allSites.sort((a, b) => {
        if (a.id === 'main') return 1;
        if (b.id === 'main') return -1;
        return 0;
    });

    // Iterate over all sites to find the user
    for (const site of sortedSites) {
        const db = await getDb(site.id);
        const user = await db.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', username);

        if (user && user.password) {
            try {
                const passwordMatch = await bcrypt.compare(password, user.password);
                if (passwordMatch) {
                    loggedInUser = user;
                    loggedInSiteId = site.id;
                    break; // Exit loop once user is found and authenticated
                }
            } catch (e) {
                 console.warn(`Bcrypt error for user '${username}' on site '${site.id}'. Hash might be invalid. Skipping. Error: ${e instanceof Error ? e.message : String(e)}`);
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


    return NextResponse.json({ 
      success: true, 
      message: 'Login successful',
      siteId: loggedInSiteId 
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
