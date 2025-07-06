
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { SITES } from '@/lib/sites';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const number = searchParams.get('number');
    const siteId = searchParams.get('siteId');

    if (!number || !siteId) {
        return NextResponse.json({ error: 'Certificate number and site ID are required.' }, { status: 400 });
    }

    if (!SITES.some(s => s.id === siteId)) {
        return NextResponse.json({ error: 'Invalid site specified.' }, { status: 400 });
    }
    
    try {
        const db = await getDb(siteId);
        
        const certificate = await db.get(
            `SELECT * FROM certificates WHERE certificate_number = ?`,
            [number]
        );

        if (!certificate) {
            return NextResponse.json({ error: 'Certificate not found.' }, { status: 404 });
        }
        
        const user = await db.get('SELECT username, fullName FROM users WHERE id = ?', certificate.user_id);
        
        let course = null;
        if (certificate.course_id) {
            course = await db.get('SELECT title, venue FROM courses WHERE id = ?', certificate.course_id);
        }

        const signatories = await db.all(`
            SELECT s.name, s.position, s.signatureImagePath
            FROM signatories s
            JOIN certificate_signatories cs ON s.id = cs.signatory_id
            WHERE cs.certificate_id = ?
        `, certificate.id);
        
        const settings = await db.all("SELECT key, value FROM app_settings WHERE key IN ('company_name', 'company_logo_path', 'company_logo_2_path', 'company_address')");
        
        const companyName = settings.find(s => s.key === 'company_name')?.value || 'Your Company Name';
        const companyLogoPath = settings.find(s => s.key === 'company_logo_path')?.value || null;
        const companyLogo2Path = settings.find(s => s.key === 'company_logo_2_path')?.value || null;
        const companyAddress = settings.find(s => s.key === 'company_address')?.value || null;

        const responseData = {
            id: certificate.id,
            completion_date: certificate.completion_date,
            certificateNumber: certificate.certificate_number,
            type: certificate.type,
            reason: certificate.reason,
            companyName: companyName,
            companyAddress: companyAddress,
            companyLogoPath: companyLogoPath,
            companyLogo2Path: companyLogo2Path,
            user: {
                username: user?.username || 'Unknown User',
                fullName: user?.fullName || null
            },
            course: course ? {
                title: course?.title || 'Unknown Course',
                venue: course?.venue || null,
            } : null,
            signatories: signatories,
        };

        return NextResponse.json(responseData);

    } catch (error) {
        console.error("Failed to validate certificate:", error);
        return NextResponse.json({ error: 'Failed to validate certificate data' }, { status: 500 });
    }
}
