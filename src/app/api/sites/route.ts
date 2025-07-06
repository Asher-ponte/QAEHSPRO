
import { NextResponse } from 'next/server';
import { getAllSites } from '@/lib/sites';

export async function GET() {
    // In a real application, you might filter sites based on user permissions.
    // For now, we return all configured sites.
    const sites = await getAllSites();
    return NextResponse.json(sites);
}
