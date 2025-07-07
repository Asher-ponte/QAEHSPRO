
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';
import { getAllSites } from '@/lib/sites';

const settingsSchema = z.object({
  companyName: z.string().min(1, "Company name cannot be empty."),
  companyLogoPath: z.string().optional(),
  companyLogo2Path: z.string().optional(),
  companyAddress: z.string().optional(),
  siteId: z.string().optional(), // For super admin to specify target
});

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
        const db = await getDb(effectiveSiteId);
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
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (user?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    let db;
    try {
        const data = await request.json();
        const parsedData = settingsSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { companyName, companyLogoPath, companyLogo2Path, companyAddress, siteId: targetSiteId } = parsedData.data;
        
        let effectiveSiteId = sessionSiteId;
        if (isSuperAdmin && targetSiteId) {
            const allSites = await getAllSites();
            if (allSites.some(s => s.id === targetSiteId)) {
                effectiveSiteId = targetSiteId;
            } else {
                return NextResponse.json({ error: 'Invalid site specified' }, { status: 400 });
            }
        }
        
        db = await getDb(effectiveSiteId);
        
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

    