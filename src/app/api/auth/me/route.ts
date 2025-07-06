
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/session';
import { getSiteById } from '@/lib/sites';

export async function GET(request: NextRequest) {
  try {
    const { user, siteId, isSuperAdmin } = await getCurrentSession();

    if (!user || !siteId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const site = await getSiteById(siteId);

    return NextResponse.json({ user, site, isSuperAdmin });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
