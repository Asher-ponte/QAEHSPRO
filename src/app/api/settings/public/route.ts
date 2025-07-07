
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface QrCodeSetting {
    label: string;
    path: string;
}

export async function GET() {
    try {
        // Public settings, especially for payments, are always from the 'external' DB.
        const db = await getDb('external');
        
        const settings = await db.all(
            "SELECT key, value FROM app_settings WHERE key LIKE 'qr_code_%'"
        );
        
        const qrCodeSettings: Record<string, Partial<QrCodeSetting>> = {};

        settings.forEach(setting => {
            const match = setting.key.match(/qr_code_(\d)_(label|path)/);
            if (match) {
                const [, index, type] = match;
                if (!qrCodeSettings[index]) {
                    qrCodeSettings[index] = {};
                }
                qrCodeSettings[index][type as keyof QrCodeSetting] = setting.value;
            }
        });

        const formattedQrCodes: QrCodeSetting[] = Object.values(qrCodeSettings)
            .filter(qr => qr.label && qr.path)
            .map(qr => ({
                label: qr.label!,
                path: qr.path!,
            }));
            
        return NextResponse.json(formattedQrCodes);
    } catch (error) {
        console.error("Failed to fetch public settings:", error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}
