
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';
import { format } from 'date-fns';

export async function GET(request: NextRequest) {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const db = await getDb();
        const [certificates] = await db.query<RowDataPacket[]>(`
            SELECT 
                c.id, 
                c.certificate_number as number,
                c.completion_date as date,
                u.fullName as userName,
                co.title as courseTitle
            FROM certificates c
            JOIN users u ON c.user_id = u.id
            LEFT JOIN courses co ON c.course_id = co.id
            ORDER BY c.id DESC
            LIMIT 100
        `);
        
        const formattedCertificates = certificates.map(c => {
            const date = format(new Date(c.date), 'MMM d, yyyy');
            const name = c.courseTitle 
                ? `${c.number} - ${c.userName} - ${c.courseTitle} (${date})` 
                : `${c.number} - ${c.userName} - Recognition (${date})`;
            return {
                id: c.id,
                name: name,
            };
        });

        return NextResponse.json(formattedCertificates);
    } catch (error) {
        console.error("Failed to fetch certificates for debug:", error);
        return NextResponse.json({ error: 'Failed to fetch certificates' }, { status: 500 });
    }
}
