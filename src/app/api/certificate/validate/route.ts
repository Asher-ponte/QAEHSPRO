

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getAllSites } from "@/lib/sites";
import type { RowDataPacket } from 'mysql2';

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
  siteId: string;
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
        const db = await getDb();
        
        const [certificateRows] = await db.query<RowDataPacket[]>(
            `SELECT * FROM certificates WHERE certificate_number = ? AND site_id = ?`,
            [number, siteId]
        );
        const certificate = certificateRows[0];

        if (!certificate) {
            return NextResponse.json({ error: 'Certificate not found.' }, { status: 404 });
        }
        
        const [userRows] = await db.query<RowDataPacket[]>('SELECT username, fullName FROM users WHERE id = ?', certificate.user_id);
        const user = userRows[0];
        
        let course = null;
        if (certificate.course_id) {
            const [courseRows] = await db.query<RowDataPacket[]>('SELECT title, venue FROM courses WHERE id = ?', certificate.course_id);
            course = courseRows[0];
        }

        const [signatoryIdRows] = await db.query<RowDataPacket[]>('SELECT signatory_id FROM certificate_signatories WHERE certificate_id = ?', certificate.id);
        const signatoryIds = signatoryIdRows.map(s => s.signatory_id);
        let signatories = [];
        if (signatoryIds.length > 0) {
            const placeholders = signatoryIds.map(() => '?').join(',');
            const [signatoryRows] = await db.query<RowDataPacket[]>(`
                SELECT s.name, s.position, s.signatureImagePath
                FROM signatories s
                WHERE s.id IN (${placeholders})
            `, signatoryIds);
            signatories = signatoryRows;
        }
        
        const [settingsRows] = await db.query<RowDataPacket[]>(
            "SELECT `key`, value FROM app_settings WHERE site_id = ? AND `key` IN ('company_name', 'company_logo_path', 'company_logo_2_path', 'company_address')",
            [siteId]
        );
        
        const settingsMap = settingsRows.reduce((acc, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {} as Record<string, string>);

        const companyName = settingsMap.company_name || 'Your Company Name';
        const companyLogoPath = settingsMap.company_logo_path || null;
        const companyLogo2Path = settingsMap.company_logo_2_path || null;
        const companyAddress = settingsMap.company_address || null;

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
            siteId: siteId,
            user: {
                username: user?.username || 'Unknown User',
                fullName: user?.fullName || null,
            },
            course: course ? {
                title: course?.title,
                venue: course?.venue,
            } : null,
            signatories: signatories,
        };

        return NextResponse.json(responseData as CertificateData);

    } catch (error) {
        console.error("Failed to validate certificate:", error);
        return NextResponse.json({ error: 'Failed to retrieve certificate data due to a server error.' }, { status: 500 });
    }
}
