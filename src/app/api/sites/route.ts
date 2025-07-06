
import { NextResponse } from 'next/server';
import { SITES } from '@/lib/sites';

export async function GET() {
    // In a real application, you might filter sites based on user permissions.
    // For now, we return all configured sites.
    return NextResponse.json(SITES);
}
