
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/session';

const settingsSchema = z.object({
  companyName: z.string().min(1, "Company name cannot be empty."),
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
        const result = await db.get("SELECT value FROM app_settings WHERE key = 'company_name'");
        return NextResponse.json({ companyName: result?.value || '' });
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const isAdmin = await checkAdmin();
    if (isAdmin) return isAdmin;
    
    try {
        const db = await getDb();
        const data = await request.json();
        const parsedData = settingsSchema.safeParse(data);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { companyName } = parsedData.data;
        
        await db.run(
            "UPDATE app_settings SET value = ? WHERE key = 'company_name'",
            [companyName]
        );

        return NextResponse.json({ success: true, message: "Settings updated" });
    } catch (error) {
        console.error("Failed to update settings:", error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
