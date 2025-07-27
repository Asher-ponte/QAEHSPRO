
'use server'

import { getDb } from '@/lib/db';
import { getAllSites } from "@/lib/sites";
import type { RowDataPacket } from 'mysql2';

export interface CertificateData {
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

export async function getCertificateDataForValidation(number: string, siteIdParam: string): Promise<{ data: CertificateData | null; error: string | null }> {
    try {
        const allSites = await getAllSites();
        if (!allSites.some(s => s.id === siteIdParam)) {
            return { data: null, error: 'Invalid site specified.' };
        }
        
        const db = await getDb();
        
        const [certificateRows] = await db.query<RowDataPacket[]>(
            `SELECT c.*
             FROM certificates c
             WHERE c.certificate_number = ? AND c.site_id = ?`,
            [number, siteIdParam]
        );
        const certificate = certificateRows[0];

        if (!certificate) {
            return { data: null, error: 'Certificate not found in the specified site.' };
        }

        let course = null;
        if (certificate.course_id) {
            const [courseRows] = await db.query<RowDataPacket[]>('SELECT title, venue FROM courses WHERE id = ?', certificate.course_id);
            if (courseRows.length === 0) return { data: null, error: 'Associated course not found.' };
            course = courseRows[0];
        }
        
        const [userRows] = await db.query<RowDataPacket[]>('SELECT username, fullName FROM users WHERE id = ?', certificate.user_id);
        const user = userRows[0];
        if (!user) return { data: null, error: 'Associated user not found.' };
        
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
            [certificate.site_id]
        );
        
        const settingsMap = settingsRows.reduce((acc, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {} as Record<string, string>);

        const responseData = {
            id: certificate.id,
            completion_date: certificate.completion_date,
            certificateNumber: certificate.certificate_number,
            type: certificate.type,
            reason: certificate.reason,
            companyName: settingsMap.company_name || 'Your Company Name',
            companyAddress: settingsMap.company_address || null,
            companyLogoPath: settingsMap.company_logo_path || null,
            companyLogo2Path: settingsMap.company_logo_2_path || null,
            siteId: certificate.site_id,
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

        return { data: responseData as CertificateData, error: null };

    } catch (error) {
        console.error("Failed to validate certificate:", error);
        return { data: null, error: 'Failed to retrieve certificate data due to a server error.' };
    }
}
