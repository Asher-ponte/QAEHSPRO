
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';
import { getAllSites } from '@/lib/sites';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const settingsSchema = z.object({
  companyName: z.string().min(1, "Company name cannot be empty."),
  companyLogoPath: z.string().optional(),
  companyLogo2Path: z.string().optional(),
  companyAddress: z.string().optional(),
  siteId: z.string().optional(), // For super admin to specify target
  qrCode1Label: z.string().optional(),
  qrCode1Path: z.string().optional(),
  qrCode2Label: z.string().optional(),
  qrCode2Path: z.string().optional(),
  qrCode3Label: z.string().optional(),
  qrCode3Path: z.string().optional(),
  qrCode4Label: z.string().optional(),
  qrCode4Path: z.string().optional(),
});

const settingKeys = [
    'company_name', 'company_logo_path', 'company_logo_2_path', 'company_address',
    'qr_code_1_label', 'qr_code_1_path',
    'qr_code_2_label', 'qr_code_2_path',
    'qr_code_3_label', 'qr_code_3_path',
    'qr_code_4_label', 'qr_code_4_path',
];

export async function GET(request: NextRequest) {
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (user?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const url = new URL(request.url);
    const requestedSiteId = url.searchParams.get('siteId');

    let effectiveSiteId = sessionSiteId;
    // Only a super admin can request settings for a different site.
    if (isSuperAdmin && requestedSiteId) {
        const allSites = await getAllSites();
        if (allSites.some(s => s.id === requestedSiteId)) {
            effectiveSiteId = requestedSiteId;
        } else {
             return NextResponse.json({ error: 'Invalid site specified' }, { status: 400 });
        }
    }

    try {
        const db = await getDb();
        const [settings] = await db.query<RowDataPacket[]>(`SELECT \`key\`, value FROM app_settings WHERE site_id = ? AND \`key\` IN (?)`, [effectiveSiteId, settingKeys]);
        
        const settingsMap = settings.reduce((acc, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {} as Record<string, string>);

        return NextResponse.json({ 
            companyName: settingsMap.company_name || '',
            companyLogoPath: settingsMap.company_logo_path || '',
            companyLogo2Path: settingsMap.company_logo_2_path || '',
            companyAddress: settingsMap.company_address || '',
            qrCode1Label: settingsMap.qr_code_1_label || '',
            qrCode1Path: settingsMap.qr_code_1_path || '',
            qrCode2Label: settingsMap.qr_code_2_label || '',
            qrCode2Path: settingsMap.qr_code_2_path || '',
            qrCode3Label: settingsMap.qr_code_3_label || '',
            qrCode3Path: settingsMap.qr_code_3_path || '',
            qrCode4Label: settingsMap.qr_code_4_label || '',
            qrCode4Path: settingsMap.qr_code_4_path || '',
         });
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (user?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const db = await getDb();
    const connection = await db.getConnection();

    try {
        const data = await request.json();
        const parsedData = settingsSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { siteId: targetSiteId, ...values } = parsedData.data;
        
        let effectiveSiteId = sessionSiteId;
        if (isSuperAdmin && targetSiteId) {
            const allSites = await getAllSites();
            if (allSites.some(s => s.id === targetSiteId)) {
                effectiveSiteId = targetSiteId;
            } else {
                return NextResponse.json({ error: 'Invalid site specified' }, { status: 400 });
            }
        }
        
        await connection.beginTransaction();
        
        const dbValues = {
            company_name: values.companyName,
            company_address: values.companyAddress,
            company_logo_path: values.companyLogoPath,
            company_logo_2_path: values.companyLogo2Path,
            qr_code_1_label: values.qrCode1Label,
            qr_code_1_path: values.qrCode1Path,
            qr_code_2_label: values.qrCode2Label,
            qr_code_2_path: values.qrCode2Path,
            qr_code_3_label: values.qrCode3Label,
            qr_code_3_path: values.qrCode3Path,
            qr_code_4_label: values.qrCode4Label,
            qr_code_4_path: values.qrCode4Path,
        };

        for (const [key, value] of Object.entries(dbValues)) {
            await connection.query(
                "INSERT INTO app_settings (site_id, `key`, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?",
                [effectiveSiteId, key, value || '', value || '']
            );
        }
        
        await connection.commit();
        
        return NextResponse.json({ success: true, message: "Settings updated" });
    } catch (error) {
        await connection.rollback();
        console.error("Failed to update settings:", error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    } finally {
        connection.release();
    }
}
