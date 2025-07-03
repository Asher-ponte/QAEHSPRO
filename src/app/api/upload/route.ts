
import { NextResponse, type NextRequest } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { getCurrentUser } from '@/lib/session';

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (user?.role !== 'Admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const data = await request.formData();
        const file: File | null = data.get('file') as unknown as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Sanitize filename and create a unique name
        const originalFilename = file.name.replace(/\s+/g, '_');
        const fileExtension = path.extname(originalFilename);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `${path.basename(originalFilename, fileExtension)}-${uniqueSuffix}${fileExtension}`;

        const uploadDir = path.join(process.cwd(), 'public', 'images');
        const fullPath = path.join(uploadDir, filename);

        await writeFile(fullPath, buffer);

        console.log(`File uploaded to ${fullPath}`);

        return NextResponse.json({ success: true, path: `/images/${filename}` });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }
}

    