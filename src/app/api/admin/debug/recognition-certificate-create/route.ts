
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { format } from 'date-fns';

const recognitionCertificateTestSchema = z.object({
  userId: z.number(),
  siteId: z.string(),
  reason: z.string().min(1, "Reason is required."),
  signatoryIds: z.array(z.number()).min(1, "At least one signatory is required."),
});

export async function POST(request: NextRequest) {
    const { user: adminUser, isSuperAdmin } = await getCurrentSession();
    if (!adminUser || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required.' }, { status: 403 });
    }

    const db = await getDb();
    const simulationLog: any = { steps: [] };

    try {
        const body = await request.json();
        const parsedBody = recognitionCertificateTestSchema.safeParse(body);
        if (!parsedBody.success) {
            throw new Error(`Invalid request body: ${JSON.stringify(parsedBody.error.flatten())}`);
        }
        
        const { userId, siteId, reason, signatoryIds } = parsedBody.data;
        simulationLog.request_body = { userId, siteId, reason, signatoryIds };

        await db.query('START TRANSACTION');
        simulationLog.steps.push({ name: 'Start Transaction', status: 'success' });
        
        const [userRows] = await db.query<RowDataPacket[]>('SELECT id, fullName FROM users WHERE id = ? AND site_id = ?', [userId, siteId]);
        if (userRows.length === 0) throw new Error(`User with ID ${userId} not found in site ${siteId}.`);
        simulationLog.steps.push({ name: 'Verify User Exists', status: 'success', data: userRows[0] });

        const [signatoryRows] = await db.query<RowDataPacket[]>('SELECT id FROM signatories WHERE id IN (?) AND site_id = ?', [signatoryIds, siteId]);
        if (signatoryRows.length !== signatoryIds.length) throw new Error('One or more selected signatories do not exist in the target site.');
        simulationLog.steps.push({ name: 'Verify Signatories Exist', status: 'success', data: { found: signatoryRows.length } });
        
        const date = new Date();
        const datePrefix = format(date, 'yyyyMMdd');
        const [countRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) as count FROM certificates WHERE certificate_number LIKE ?`, [`QAEHS-${datePrefix}-%`]);
        const count = countRows[0]?.count ?? 0;
        const nextSerial = count + 1;
        const certificateNumber = `QAEHS-${datePrefix}-${String(nextSerial).padStart(4, '0')}`;
        simulationLog.steps.push({ name: 'Generate Certificate Number', status: 'success', data: { certificateNumber } });
        
        const [certResult] = await db.query<ResultSetHeader>(
            `INSERT INTO certificates (user_id, course_id, completion_date, certificate_number, type, reason, site_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, null, date, certificateNumber, 'recognition', reason, siteId]
        );
        const certificateId = certResult.insertId;
        if (!certificateId) throw new Error("Failed to insert certificate record.");
        simulationLog.steps.push({ name: 'Insert Certificate Record', status: 'success', data: { certificateId } });
        
        for (const signatoryId of signatoryIds) {
            await db.query('INSERT INTO certificate_signatories (certificate_id, signatory_id) VALUES (?, ?)', [certificateId, signatoryId]);
        }
        simulationLog.steps.push({ name: 'Link Signatories', status: 'success', data: { count: signatoryIds.length } });

        await db.query('ROLLBACK');
        simulationLog.steps.push({ name: 'Rollback Transaction', status: 'success' });

        return NextResponse.json({
            message: "Simulation successful. All changes were rolled back.",
            simulation: simulationLog,
        });

    } catch (error) {
        await db.query('ROLLBACK').catch(e => {
            simulationLog.steps.push({ name: 'Rollback on Error', status: 'failed', details: e.message });
        });

        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        simulationLog.steps.push({ name: 'Test Execution Failed', status: 'failed', details: errorMessage });

        return NextResponse.json({ 
            error: 'Test failed during execution.', 
            details: errorMessage,
            simulation: simulationLog,
        }, { status: 500 });
    }
}
