
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SITES } from '@/lib/sites';

const switchSiteSchema = z.object({
  siteId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedData = switchSiteSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Site ID is required.' }, { status: 400 });
    }
    
    const { siteId } = parsedData.data;

    // Validate that it's a real site
    if (!SITES.some(site => site.id === siteId)) {
        return NextResponse.json({ error: 'Invalid site specified.' }, { status: 400 });
    }

    // This simply updates the site cookie. The client is expected to reload.
    cookies().set('site_id', siteId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return NextResponse.json({ success: true, message: 'Site switched successfully.' });
  } catch (error) {
    console.error('Site switch error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
