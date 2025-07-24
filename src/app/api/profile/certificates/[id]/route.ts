
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const { user: sessionUser, siteId } = await getCurrentSession();
    if (!sessionUser || !siteId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const db = await getDb();
        const certificateId = params.id;

        const [certificateRows] = await db.query<RowDataPacket[]>(
            `SELECT * FROM certificates WHERE id = ? AND user_id = ?`,
            [certificateId, sessionUser.id]
        );
        const certificate = certificateRows[0];

        if (!certificate) {
            return NextResponse.json({ error: 'Certificate not found or you do not have permission to view it.' }, { status: 404 });
        }
        
        const certificateSiteId = certificate.site_id;

        // --- Payment Verification Logic ---
        if (sessionUser.type === 'External' && certificate.course_id) {
            const [courseRows] = await db.query<RowDataPacket[]>('SELECT price FROM courses WHERE id = ?', [certificate.course_id]);
            const course = courseRows[0];
            
            if (course && course.price > 0) {
                const [transactionRows] = await db.query<RowDataPacket[]>(
                    `SELECT status FROM transactions WHERE user_id = ? AND course_id = ? ORDER BY transaction_date DESC LIMIT 1`,
                    [sessionUser.id, certificate.course_id]
                );
                const transaction = transactionRows[0];

                if (!transaction || transaction.status !== 'completed') {
                    return NextResponse.json({ error: 'Certificate is not available until payment has been confirmed by an administrator.' }, { status: 403 });
                }
            }
        }
        // --- End Payment Verification ---

        const [userRows] = await db.query<RowDataPacket[]>('SELECT username, fullName FROM users WHERE id = ?', [certificate.user_id]);
        const certificateHolder = userRows[0];
        
        let course = null;
        if (certificate.course_id) {
            const [courseRows] = await db.query<RowDataPacket[]>('SELECT title, venue FROM courses WHERE id = ?', [certificate.course_id]);
            course = courseRows[0];
        }

        const [signatoryIdRows] = await db.query<RowDataPacket[]>('SELECT signatory_id FROM certificate_signatories WHERE certificate_id = ?', [certificate.id]);
        const signatoryIds = signatoryIdRows.map(s => s.signatory_id);
        
        let signatories = [];
        if (signatoryIds.length > 0) {
            const placeholders = signatoryIds.map(() => '?').join(',');
            const [signatoryRows] = await db.query<RowDataPacket[]>(`
                SELECT s.name, s.position, s.signatureImagePath
                FROM signatories s
                WHERE s.id IN (${placeholders})
            `, signatoryIds);
            signatories = signatoryRows;
        }
        
        const [settingsRows] = await db.query<RowDataPacket[]>(
            "SELECT `key`, value FROM app_settings WHERE site_id = ? AND `key` IN ('company_name', 'company_logo_path', 'company_logo_2_path', 'company_address')",
            [certificateSiteId]
        );
        
        const settingsMap = settingsRows.reduce((acc, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {} as Record<string, string>);

        const companyName = settingsMap.company_name || 'Your Company Name';
        const companyLogoPath = settingsMap.company_logo_path || null;
        const companyLogo2Path = settingsMap.company_logo_2_path || null;
        const companyAddress = settingsMap.company_address || null;

        const responseData = {
            id: certificate.id,
            completion_date: certificate.completion_date,
            certificateNumber: certificate.certificate_number,
            type: certificate.type,
            reason: certificate.reason,
            companyName: companyName,
            companyAddress: companyAddress,
            companyLogoPath: companyLogoPath,
            companyLogo2Path: companyLogo2Path,
            user: {
                username: certificateHolder?.username || 'Unknown User',
                fullName: certificateHolder?.fullName || null
            },
            course: course ? {
                title: course?.title || 'Unknown Course',
                venue: course?.venue || null,
            } : null,
            signatories: signatories,
        };

        return NextResponse.json(responseData);

    } catch (error) {
        console.error("Failed to fetch certificate:", error);
        return NextResponse.json({ error: 'Failed to fetch certificate data' }, { status: 500 });
    }
}
