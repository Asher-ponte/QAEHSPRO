
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const db = await getDb();
        const certificateId = params.id;

        const certificate = await db.get(
            `SELECT *, certificate_number FROM certificates WHERE id = ? AND user_id = ?`,
            [certificateId, user.id]
        );

        if (!certificate) {
            return NextResponse.json({ error: 'Certificate not found or you do not have permission to view it.' }, { status: 404 });
        }
        
        const course = await db.get('SELECT title FROM courses WHERE id = ?', certificate.course_id);
        const signatories = await db.all('SELECT name, position, signatureImagePath FROM signatories');
        const companyNameResult = await db.get("SELECT value FROM app_settings WHERE key = 'company_name'");

        const responseData = {
            id: certificate.id,
            completion_date: certificate.completion_date,
            certificateNumber: certificate.certificate_number,
            companyName: companyNameResult?.value || 'Your Company Name',
            user: {
                username: user.username,
            },
            course: {
                title: course?.title || 'Unknown Course',
            },
            signatories: signatories,
        };

        return NextResponse.json(responseData);

    } catch (error) {
        console.error("Failed to fetch certificate:", error);
        return NextResponse.json({ error: 'Failed to fetch certificate data' }, { status: 500 });
    }
}
