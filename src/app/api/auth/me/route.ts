
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/session';
import { getSiteById } from '@/lib/sites';

export async function GET(request: NextRequest) {
  try {
    const { user, siteId } = await getCurrentSession();

    if (!user || !siteId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const site = getSiteById(siteId);

    return NextResponse.json({ user, site });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
