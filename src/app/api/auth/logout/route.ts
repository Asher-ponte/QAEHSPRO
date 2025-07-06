
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    try {
        cookies().delete('session_id');
        cookies().delete('site_id');
        return NextResponse.json({ success: true, message: 'Logout successful' });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
    }
}
