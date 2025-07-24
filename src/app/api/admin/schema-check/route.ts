
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

const EXPECTED_SCHEMA: Record<string, string[]> = {
    sites: ['id', 'name'],
    users: ['id', 'site_id', 'username', 'password', 'fullName', 'department', 'position', 'role', 'type', 'email', 'phone'],
    courses: ['id', 'site_id', 'title', 'description', 'category', 'imagePath', 'venue', 'startDate', 'endDate', 'is_internal', 'is_public', 'price', 'passing_rate', 'max_attempts', 'final_assessment_content'],
    modules: ['id', 'course_id', 'title', 'order'],
    lessons: ['id', 'module_id', 'title', 'type', 'content', 'imagePath', 'documentPath', 'order'],
    enrollments: ['user_id', 'course_id'],
    user_progress: ['user_id', 'lesson_id', 'completed'],
    quiz_attempts: ['id', 'user_id', 'lesson_id', 'course_id', 'site_id', 'score', 'total', 'attempt_date'],
    final_assessment_attempts: ['id', 'user_id', 'course_id', 'site_id', 'score', 'total', 'passed', 'attempt_date'],
    signatories: ['id', 'site_id', 'name', 'position', 'signatureImagePath'],
    certificates: ['id', 'user_id', 'course_id', 'site_id', 'completion_date', 'certificate_number', 'type', 'reason'],
    course_signatories: ['course_id', 'signatory_id'],
    certificate_signatories: ['certificate_id', 'signatory_id'],
    transactions: ['id', 'user_id', 'course_id', 'amount', 'status', 'gateway', 'gateway_transaction_id', 'transaction_date', 'proof_image_path', 'rejection_reason'],
    app_settings: ['id', 'site_id', 'key', 'value'],
};

export async function GET() {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
    }

    try {
        const db = await getDb();
        const dbName = process.env.DB_NAME;

        const validationResults = [];

        for (const tableName of Object.keys(EXPECTED_SCHEMA)) {
            const result: {
                tableName: string;
                exists: boolean;
                columns: { name: string; found: boolean }[];
                missingColumns: string[];
                ok: boolean;
            } = {
                tableName,
                exists: false,
                columns: [],
                missingColumns: [],
                ok: false,
            };

            const [tableRows] = await db.query<RowDataPacket[]>(
                `SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
                [dbName, tableName]
            );

            if (tableRows.length > 0) {
                result.exists = true;

                const [columnRows] = await db.query<RowDataPacket[]>(
                    `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?`,
                    [dbName, tableName]
                );
                const actualColumns = new Set(columnRows.map(c => c.column_name));
                const expectedColumns = EXPECTED_SCHEMA[tableName];

                for (const col of expectedColumns) {
                    const found = actualColumns.has(col);
                    result.columns.push({ name: col, found });
                    if (!found) {
                        result.missingColumns.push(col);
                    }
                }
                result.ok = result.missingColumns.length === 0;
            } else {
                result.ok = false;
            }
            validationResults.push(result);
        }

        return NextResponse.json(validationResults);
    } catch (error) {
        console.error("Failed to check schema:", error);
        const details = error instanceof Error ? error.message : "An unknown error occurred.";
        return NextResponse.json({ error: 'Failed to check database schema.', details }, { status: 500 });
    }
}
