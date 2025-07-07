
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getAllSites } from "@/lib/sites";

interface CertificateData {
  id: number;
  completion_date: string;
  certificateNumber: string | null;
  type: 'completion' | 'recognition';
  reason: string | null;
  companyName: string;
  companyAddress: string | null;
  companyLogoPath: string | null;
  companyLogo2Path: string | null;
  user: { username: string; fullName: string | null };
  course: { title: string; venue: string | null } | null;
  signatories: { name: string; position: string | null; signatureImagePath: string }[];
}

export async function GET(request: NextRequest): Promise<NextResponse<CertificateData | { error: string }>> {
    const { searchParams } = new URL(request.url);
    const number = searchParams.get('number');
    const siteId = searchParams.get('siteId');

    if (!number || !siteId) {
        return NextResponse.json({ error: 'Certificate number and site ID are required.' }, { status: 400 });
    }
    
    const allSites = await getAllSites();
    if (!allSites.some(s => s.id === siteId)) {
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

        const signatoryIdsResult = await db.all('SELECT signatory_id FROM certificate_signatories WHERE certificate_id = ?', certificate.id);
        const signatoryIds = signatoryIdsResult.map(s => s.signatory_id);
        let signatories = [];
        if (signatoryIds.length > 0) {
            const placeholders = signatoryIds.map(() => '?').join(',');
            signatories = await db.all(`
                SELECT s.name, s.position, s.signatureImagePath
                FROM signatories s
                WHERE s.id IN (${placeholders})
            `, signatoryIds);
        }
        
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
                fullName: user?.fullName || null,
            },
            course: course,
            signatories: signatories,
        };

        return NextResponse.json(responseData);

    } catch (error) {
        console.error("Failed to validate certificate:", error);
        return NextResponse.json({ error: 'Failed to retrieve certificate data due to a server error.' }, { status: 500 });
    }
}
