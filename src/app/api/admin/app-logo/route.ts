
import { NextResponse, type NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getCurrentSession } from '@/lib/session';
import { getDb } from '@/lib/db';

export async function POST(request: NextRequest) {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
    }

    try {
        const data = await request.formData();
        const file: File | null = data.get('file') as unknown as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // The specific filename for the main app logo
        const filename = 'logo.png';
        const publicPath = `/uploads/${filename}`;
        
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });
        
        const fullPath = path.join(uploadDir, filename);

        // Overwrite the existing file
        await writeFile(fullPath, buffer);

        // Also update the setting in the main database for consistency.
        // This ensures if we ever make the logo dynamic, the path is already stored.
        const mainDb = await getDb('main');
        await mainDb.run(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
            ['company_logo_path', publicPath]
        );
        
        console.log(`Main app logo updated at ${fullPath}`);
        return NextResponse.json({ success: true, path: publicPath });

    } catch (error) {
        console.error("App logo upload error:", error);
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }
}
