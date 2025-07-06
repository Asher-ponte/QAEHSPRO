
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';

const settingsSchema = z.object({
  companyName: z.string().min(1, "Company name cannot be empty."),
  companyLogoPath: z.string().optional(),
  companyLogo2Path: z.string().optional(),
  companyAddress: z.string().optional(),
});

async function checkAdmin() {
    const { user, siteId } = await getCurrentSession();
    if (user?.role !== 'Admin' || !siteId) {
        return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }), siteId: null };
    }
    return { response: null, siteId };
}

export async function GET() {
    const { response, siteId } = await checkAdmin();
    if (response) return response;

    try {
        const db = await getDb(siteId!);
        const settings = await db.all("SELECT key, value FROM app_settings WHERE key IN ('company_name', 'company_logo_path', 'company_logo_2_path', 'company_address')");
        const companyName = settings.find(s => s.key === 'company_name')?.value || '';
        const companyLogoPath = settings.find(s => s.key === 'company_logo_path')?.value || '';
        const companyLogo2Path = settings.find(s => s.key === 'company_logo_2_path')?.value || '';
        const companyAddress = settings.find(s => s.key === 'company_address')?.value || '';
        return NextResponse.json({ companyName, companyLogoPath, companyLogo2Path, companyAddress });
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const { response, siteId } = await checkAdmin();
    if (response) return response;
    
    let db;
    try {
        db = await getDb(siteId!);
        const data = await request.json();
        const parsedData = settingsSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { companyName, companyLogoPath, companyLogo2Path, companyAddress } = parsedData.data;
        
        await db.run('BEGIN TRANSACTION');
        
        await db.run(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
            ['company_name', companyName]
        );
        
        await db.run(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
            ['company_logo_path', companyLogoPath || '']
        );

        await db.run(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
            ['company_logo_2_path', companyLogo2Path || '']
        );
        
        await db.run(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
            ['company_address', companyAddress || '']
        );
        
        await db.run('COMMIT');

        return NextResponse.json({ success: true, message: "Settings updated" });
    } catch (error) {
        if (db) {
            await db.run('ROLLBACK').catch(console.error);
        }
        console.error("Failed to update settings:", error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
