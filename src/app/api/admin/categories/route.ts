
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  const { user, siteId, isSuperAdmin } = await getCurrentSession();
  if (user?.role !== 'Admin' || !siteId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const db = await getDb();
    
    let query;
    let params: (string | undefined)[] = [];

    // Super admin should see all categories across all sites.
    if (isSuperAdmin) {
        query = `SELECT DISTINCT category FROM courses WHERE category IS NOT NULL AND category != '' ORDER BY category`;
    } else {
        query = `SELECT DISTINCT category FROM courses WHERE category IS NOT NULL AND category != '' AND site_id = ? ORDER BY category`;
        params.push(siteId);
    }
    
    const [categoriesResult] = await db.query<RowDataPacket[]>(query, params);
    
    const categories = categoriesResult.map(c => c.category);
    
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
