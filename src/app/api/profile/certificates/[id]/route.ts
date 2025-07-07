
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const { user: sessionUser, siteId } = await getCurrentSession();
    if (!sessionUser || !siteId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const db = await getDb(siteId);
        const certificateId = params.id;

        const certificate = await db.get(
            `SELECT * FROM certificates WHERE id = ? AND user_id = ?`,
            [certificateId, sessionUser.id]
        );

        if (!certificate) {
            return NextResponse.json({ error: 'Certificate not found or you do not have permission to view it.' }, { status: 404 });
        }
        
        const certificateHolder = await db.get('SELECT username, fullName FROM users WHERE id = ?', certificate.user_id);
        
        let course = null;
        if (certificate.course_id) {
            course = await db.get('SELECT title, venue FROM courses WHERE id = ?', certificate.course_id);
        }

        const mainDb = await getDb('main');
        const signatoryIdsResult = await db.all('SELECT signatory_id FROM certificate_signatories WHERE certificate_id = ?', certificate.id);
        const signatoryIds = signatoryIdsResult.map(s => s.signatory_id);
        let signatories = [];
        if (signatoryIds.length > 0) {
            const placeholders = signatoryIds.map(() => '?').join(',');
            signatories = await mainDb.all(`
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
                username: certificateHolder?.username || 'Unknown User',
                fullName: certificateHolder?.fullName || null
            },
            course: course ? {
                title: course?.title || 'Unknown Course',
                venue: course?.venue || null,
            } : null,
            signatories: signatories,
        };

        return NextResponse.json(responseData);

    } catch (error) {
        console.error("Failed to fetch certificate:", error);
        return NextResponse.json({ error: 'Failed to fetch certificate data' }, { status: 500 });
    }
}
