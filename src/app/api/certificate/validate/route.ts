
import { NextResponse, type NextRequest } from 'next/server';
import { getCertificateDataForValidation } from '@/lib/certificate';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const number = searchParams.get('number');
    const siteId = searchParams.get('siteId');

    if (!number || !siteId) {
        return NextResponse.json({ error: 'Certificate number and site ID are required.' }, { status: 400 });
    }
    
    try {
        const { data, error } = await getCertificateDataForValidation(number, siteId);
        if (error) {
             // Use a 404 for not found, and 400 for other validation errors.
             const status = error === 'Certificate not found.' ? 404 : 400;
             return NextResponse.json({ error }, { status });
        }
        return NextResponse.json(data);
    } catch (error) {
        console.error("API route /api/certificate/validate failed:", error);
        return NextResponse.json({ error: 'Failed to retrieve certificate data due to a server error.' }, { status: 500 });
    }
}
