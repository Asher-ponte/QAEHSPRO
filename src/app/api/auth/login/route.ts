
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
    
    // A valid bcrypt hash starts with $2a$, $2b$, or $2y$, a cost factor, and is 60 characters long.
    const isValidBcryptHash = (hash: string | null | undefined): boolean => {
        if (!hash) return false;
        return /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash);
    };

    // Iterate over all sites to find the user
    for (const site of SITES) {
        const db = await getDb(site.id);
        const user = await db.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', username);

        // This is the critical check. We only proceed if the user exists AND their password hash is valid.
        if (user && isValidBcryptHash(user.password)) {
            // Because of the check above, this call is now safe and will not crash.
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (passwordMatch) {
                loggedInUser = user;
                loggedInSiteId = site.id;
                break; // Exit loop once user is found and authenticated
            }
        } else if (user && !isValidBcryptHash(user.password)) {
            // This case handles users with invalid/corrupted passwords. We log it and skip them.
            console.warn(`Skipping user '${username}' on site '${site.id}' due to an invalid password format in the database.`);
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
