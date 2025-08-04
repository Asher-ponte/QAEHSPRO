
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';
import { format } from 'date-fns';
import { getAllSites } from '@/lib/sites';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const recognitionCertificateSchema = z.object({
  userId: z.coerce.number({ invalid_type_error: "Please select a user." }),
  reason: z.string().min(10, { message: "Reason must be at least 10 characters." }),
  date: z.date(),
  signatoryIds: z.array(z.number()).min(1, { message: "At least one signatory is required." }),
  siteId: z.string().optional(),
});

export async function POST(request: NextRequest) {
    const { user: adminUser, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (adminUser?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let db;
    try {
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
        
        const { userId, reason, date, signatoryIds, siteId: targetSiteId } = parsedData.data;

        let effectiveSiteId = sessionSiteId;
        if (targetSiteId) {
             if (!isSuperAdmin) {
                return NextResponse.json({ error: 'Forbidden: Only Super Admins can specify a branch.' }, { status: 403 });
            }
            const allSites = await getAllSites();
            if (!allSites.some(s => s.id === targetSiteId)) {
                return NextResponse.json({ error: 'Invalid target site ID.' }, { status: 400 });
            }
            effectiveSiteId = targetSiteId;
        }

        db = await getDb();

        await db.query('START TRANSACTION');
        
        const dateForSerial = format(date, 'yyyy-MM-dd');

        // Atomically create or increment the serial number for the given day
        await db.query(
            `INSERT INTO certificate_serials (prefix, serial_date, last_serial) VALUES ('QAEHS', ?, 1) ON DUPLICATE KEY UPDATE last_serial = last_serial + 1`,
            [dateForSerial]
        );
        const [serialRows] = await db.query<RowDataPacket[]>(
            `SELECT last_serial FROM certificate_serials WHERE prefix = 'QAEHS' AND serial_date = ?`,
            [dateForSerial]
        );
        const nextSerial = serialRows[0].last_serial;

        const certificateNumber = `QAEHS-${format(date, 'yyyyMMdd')}-${String(nextSerial).padStart(4, '0')}`;


        const [certResult] = await db.query<ResultSetHeader>(
            `INSERT INTO certificates (user_id, course_id, completion_date, certificate_number, type, reason) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, null, date, certificateNumber, 'recognition', reason]
        );
        const certificateId = certResult.insertId;
        if (!certificateId) {
            throw new Error("Failed to create certificate record.");
        }
        
        for (const signatoryId of signatoryIds) {
            await db.query('INSERT INTO certificate_signatories (certificate_id, signatory_id) VALUES (?, ?)', [certificateId, signatoryId]);
        }
        
        await db.query('COMMIT');

        return NextResponse.json({ success: true, certificateId: certificateId }, { status: 201 });

    } catch (error) {
        if (db) {
            await db.query('ROLLBACK').catch(console.error);
        }
        console.error("Failed to create recognition certificate:", error);
        const details = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to create certificate', details }, { status: 500 });
    }
}
