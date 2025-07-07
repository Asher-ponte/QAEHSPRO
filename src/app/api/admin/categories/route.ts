
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export async function GET() {
  const { user, siteId } = await getCurrentSession();
  if (user?.role !== 'Admin' || !siteId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const db = await getDb(siteId);
    const categoriesResult = await db.all(`
      SELECT DISTINCT category FROM courses WHERE category IS NOT NULL AND category != '' ORDER BY category
    `);
    
    const categories = categoriesResult.map(c => c.category);
    
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
