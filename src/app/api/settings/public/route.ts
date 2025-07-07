
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
    try {
        const db = await getDb('external'); // QR codes for public payment are stored with the external site settings
        const settings = await db.all(
            `SELECT key, value FROM app_settings 
             WHERE key LIKE 'qr_code_%_path' OR key LIKE 'qr_code_%_label'`
        );

        const settingsMap = settings.reduce((acc, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {} as Record<string, string>);

        const qrCodes = [1, 2, 3, 4].map(i => ({
            label: settingsMap[`qr_code_${i}_label`] || '',
            path: settingsMap[`qr_code_${i}_path`] || '',
        })).filter(qr => qr.path && qr.label);

        return NextResponse.json(qrCodes);

    } catch (error) {
        console.error("Failed to fetch public settings:", error);
        return NextResponse.json({ error: 'Failed to fetch public settings' }, { status: 500 });
    }
}
