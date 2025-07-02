
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/session';

const settingsSchema = z.object({
  companyName: z.string().min(1, "Company name cannot be empty."),
  companyLogoPath: z.string().optional(),
  companyLogo2Path: z.string().optional(),
});

async function checkAdmin() {
    const user = await getCurrentUser();
    if (user?.role !== 'Admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return null;
}

export async function GET() {
    const isAdmin = await checkAdmin();
    if (isAdmin) return isAdmin;

    try {
        const db = await getDb();
        const settings = await db.all("SELECT key, value FROM app_settings WHERE key IN ('company_name', 'company_logo_path', 'company_logo_2_path')");
        const companyName = settings.find(s => s.key === 'company_name')?.value || '';
        const companyLogoPath = settings.find(s => s.key === 'company_logo_path')?.value || '';
        const companyLogo2Path = settings.find(s => s.key === 'company_logo_2_path')?.value || '';
        return NextResponse.json({ companyName, companyLogoPath, companyLogo2Path });
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const isAdmin = await checkAdmin();
    if (isAdmin) return isAdmin;
    
    let db;
    try {
        db = await getDb();
        const data = await request.json();
        const parsedData = settingsSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { companyName, companyLogoPath, companyLogo2Path } = parsedData.data;
        
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
