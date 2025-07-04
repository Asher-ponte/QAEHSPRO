
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/session';
import { format } from 'date-fns';

const recognitionCertificateSchema = z.object({
  userId: z.coerce.number(),
  reason: z.string().min(10, "Reason must be at least 10 characters."),
  date: z.date(),
  signatoryIds: z.array(z.number()).min(1, "At least one signatory is required."),
});

export async function POST(request: NextRequest) {
    const adminUser = await getCurrentUser();
    if (adminUser?.role !== 'Admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let db;
    try {
        db = await getDb();
        const body = await request.json();
        
        // Zod needs to parse a date object, but JSON gives a string.
        const bodyWithDate = {
            ...body,
            date: new Date(body.date),
        }
        
        const parsedData = recognitionCertificateSchema.safeParse(bodyWithDate);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        const { userId, reason, date, signatoryIds } = parsedData.data;

        await db.run('BEGIN TRANSACTION');
        
        // Generate certificate number
        const datePrefix = format(date, 'yyyyMMdd');
        const countResult = await db.get(`SELECT COUNT(*) as count FROM certificates WHERE certificate_number LIKE ?`, [`QAEHS-${datePrefix}-%`]);
        const nextSerial = (countResult?.count ?? 0) + 1;
        const certificateNumber = `QAEHS-${datePrefix}-${String(nextSerial).padStart(4, '0')}`;

        // Create the certificate record
        const certResult = await db.run(
            `INSERT INTO certificates (user_id, course_id, completion_date, certificate_number, type, reason) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, null, date.toISOString(), certificateNumber, 'recognition', reason]
        );
        const certificateId = certResult.lastID;
        if (!certificateId) {
            throw new Error("Failed to create certificate record.");
        }
        
        // Link signatories to this certificate
        const stmt = await db.prepare('INSERT INTO certificate_signatories (certificate_id, signatory_id) VALUES (?, ?)');
        for (const signatoryId of signatoryIds) {
            await stmt.run(certificateId, signatoryId);
        }
        await stmt.finalize();

        await db.run('COMMIT');

        return NextResponse.json({ success: true, certificateId: certificateId }, { status: 201 });

    } catch (error) {
        if (db) {
            await db.run('ROLLBACK').catch(console.error);
        }
        console.error("Failed to create recognition certificate:", error);
        const details = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to create certificate', details }, { status: 500 });
    }
}
