
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const db = await getDb();
        const certificateId = params.id;

        const certificate = await db.get(
            `SELECT *, certificate_number FROM certificates WHERE id = ? AND user_id = ?`,
            [certificateId, user.id]
        );

        if (!certificate) {
            return NextResponse.json({ error: 'Certificate not found or you do not have permission to view it.' }, { status: 404 });
        }
        
        const course = await db.get('SELECT title FROM courses WHERE id = ?', certificate.course_id);
        const signatories = await db.all(`
            SELECT s.name, s.position, s.signatureImagePath
            FROM signatories s
            JOIN course_signatories cs ON s.id = cs.signatory_id
            WHERE cs.course_id = ?
        `, certificate.course_id);
        
        const settings = await db.all("SELECT key, value FROM app_settings WHERE key IN ('company_name', 'company_logo_path', 'company_logo_2_path', 'company_address')");
        
        const companyName = settings.find(s => s.key === 'company_name')?.value || 'Your Company Name';
        const companyLogoPath = settings.find(s => s.key === 'company_logo_path')?.value || null;
        const companyLogo2Path = settings.find(s => s.key === 'company_logo_2_path')?.value || null;
        const companyAddress = settings.find(s => s.key === 'company_address')?.value || null;

        const responseData = {
            id: certificate.id,
            completion_date: certificate.completion_date,
            certificateNumber: certificate.certificate_number,
            companyName: companyName,
            companyAddress: companyAddress,
            companyLogoPath: companyLogoPath,
            companyLogo2Path: companyLogo2Path,
            user: {
                username: user.username,
            },
            course: {
                title: course?.title || 'Unknown Course',
            },
            signatories: signatories,
        };

        return NextResponse.json(responseData);

    } catch (error) {
        console.error("Failed to fetch certificate:", error);
        return NextResponse.json({ error: 'Failed to fetch certificate data' }, { status: 500 });
    }
}
