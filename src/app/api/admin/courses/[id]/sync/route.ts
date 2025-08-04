

'use server';
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const syncRequestSchema = z.object({
  targetSiteIds: z.array(z.string()).min(1, "At least one branch must be selected for sync."),
});

// Helper to get the complete, raw data for a course from the main DB.
async function getFullCourseDataFromMain(mainDb: any, courseId: number) {
    const [courseRows] = await mainDb.query<RowDataPacket[]>('SELECT * FROM courses WHERE id = ?', courseId);
    const course = courseRows[0];
    if (!course) {
        throw new Error('Master course not found in main branch.');
    }

    const [modulesAndLessons] = await mainDb.query<RowDataPacket[]>(`
        SELECT 
            m.id as module_id, 
            m.title as module_title, 
            m.order as module_order,
            l.id as lesson_id,
            l.title as lesson_title,
            l.type as lesson_type,
            l.content as lesson_content,
            l.imagePath as lesson_imagePath,
            l.documentPath as lesson_documentPath,
            l.order as lesson_order
        FROM modules m
        LEFT JOIN lessons l ON m.id = l.module_id
        WHERE m.course_id = ?
        ORDER BY m.order ASC, l.order ASC
    `, courseId);
    
    const modulesMap = new Map<number, any>();
    for (const row of modulesAndLessons) {
        if (!modulesMap.has(row.module_id)) {
            modulesMap.set(row.module_id, {
                id: row.module_id,
                title: row.module_title,
                lessons: []
            });
        }
        if (row.lesson_id) {
            modulesMap.get(row.module_id).lessons.push({
                id: row.lesson_id,
                title: row.lesson_title,
                type: row.lesson_type,
                content: row.lesson_content ?? null, 
                imagePath: row.lesson_imagePath ?? null,
                documentPath: row.lesson_documentPath ?? null
            });
        }
    }
    course.modules = Array.from(modulesMap.values());
    
    const [assignedSignatories] = await mainDb.query<RowDataPacket[]>('SELECT signatory_id FROM course_signatories WHERE course_id = ?', courseId);
    course.signatoryIds = assignedSignatories.map((s: any) => s.signatory_id);
    
    return course;
}

// Helper to apply the master course data to a target branch's DB.
async function syncCourseToDb(db: any, targetSiteId: string, masterCourseData: any) {
    const [targetCourseRows] = await db.query<RowDataPacket[]>('SELECT id, price FROM courses WHERE title = ? AND site_id = ?', [masterCourseData.title, targetSiteId]);
    const targetCourse = targetCourseRows[0];

    if (!targetCourse) {
        throw new Error(`Course "${masterCourseData.title}" not found in branch "${targetSiteId}".`);
    }
    const targetCourseId = targetCourse.id;
    
    await db.query('START TRANSACTION');

    try {
        // Update main course details
        await db.query(
            `UPDATE courses SET 
                description = ?, category = ?, imagePath = ?, venue = ?, 
                startDate = ?, endDate = ?, is_internal = ?, is_public = ?,
                final_assessment_content = ?, final_assessment_passing_rate = ?, final_assessment_max_attempts = ?
             WHERE id = ?`,
            [
                masterCourseData.description, masterCourseData.category, masterCourseData.imagePath, masterCourseData.venue,
                masterCourseData.startDate, masterCourseData.endDate, masterCourseData.is_internal, masterCourseData.is_public,
                masterCourseData.final_assessment_content, masterCourseData.final_assessment_passing_rate, masterCourseData.final_assessment_max_attempts,
                targetCourseId
            ]
        );
        
        // Non-destructive update for modules and lessons
        const [existingModuleRows] = await db.query<RowDataPacket[]>('SELECT id FROM modules WHERE course_id = ?', [targetCourseId]);
        const existingModuleIds = new Set(existingModuleRows.map(m => m.id));
        const payloadModuleIds = new Set(masterCourseData.modules.map((m: any) => m.id));

        for (const existingId of existingModuleIds) {
            if (!payloadModuleIds.has(existingId)) { 
                const [lessonIdsToDelete] = await db.query<RowDataPacket[]>('SELECT id FROM lessons WHERE module_id = ?', [existingId]);
                const lessonIds = lessonIdsToDelete.map(l => l.id);
                if (lessonIds.length > 0) {
                     await db.query('DELETE FROM quiz_attempts WHERE lesson_id IN (?)', [lessonIds]);
                     await db.query('DELETE FROM user_progress WHERE lesson_id IN (?)', [lessonIds]);
                }
                await db.query('DELETE FROM lessons WHERE module_id = ?', [existingId]);
                await db.query('DELETE FROM modules WHERE id = ?', [existingId]); 
            }
        }
        
        for (const [moduleIndex, moduleData] of masterCourseData.modules.entries()) {
            let moduleId = moduleData.id;
            if (moduleId && existingModuleIds.has(moduleId)) {
                await db.query('UPDATE modules SET title = ?, \`order\` = ? WHERE id = ?', [moduleData.title, moduleIndex + 1, moduleId]);
            } else {
                 const [moduleResult] = await db.query<ResultSetHeader>('INSERT INTO modules (course_id, title, `order`) VALUES (?, ?, ?)', [targetCourseId, moduleData.title, moduleIndex + 1]);
                 moduleId = moduleResult.insertId;
            }

            const [existingLessonRows] = await db.query<RowDataPacket[]>('SELECT id FROM lessons WHERE module_id = ?', [moduleId]);
            const existingLessonIds = new Set(existingLessonRows.map(l => l.id));
            const payloadLessonIds = new Set(moduleData.lessons.map((l: any) => l.id));

            for (const existingId of existingLessonIds) {
                if (!payloadLessonIds.has(existingId)) { 
                    await db.query('DELETE FROM quiz_attempts WHERE lesson_id = ?', [existingId]);
                    await db.query('DELETE FROM user_progress WHERE lesson_id = ?', [existingId]);
                    await db.query('DELETE FROM lessons WHERE id = ?', [existingId]); 
                }
            }

            for (const [lessonIndex, lessonData] of moduleData.lessons.entries()) {
                if (lessonData.id && existingLessonIds.has(lessonData.id)) {
                    await db.query('UPDATE lessons SET title = ?, type = ?, content = ?, \`order\` = ?, imagePath = ?, documentPath = ? WHERE id = ?', [lessonData.title, lessonData.type, lessonData.content, lessonIndex + 1, lessonData.imagePath, lessonData.documentPath, lessonData.id]);
                } else {
                    await db.query('INSERT INTO lessons (module_id, title, type, content, \`order\`, imagePath, documentPath) VALUES (?, ?, ?, ?, ?, ?, ?)', [moduleId, lessonData.title, lessonData.type, lessonData.content, lessonIndex + 1, lessonData.imagePath, lessonData.documentPath]);
                }
            }
        }

        // Sync signatories
        await db.query('DELETE FROM course_signatories WHERE course_id = ?', targetCourseId);
        if (masterCourseData.signatoryIds && masterCourseData.signatoryIds.length > 0) {
            for (const signatoryId of masterCourseData.signatoryIds) {
                await db.query('INSERT INTO course_signatories (course_id, signatory_id) VALUES (?, ?)', [targetCourseId, signatoryId]);
            }
        }
        
        await db.query('COMMIT');
    } catch (e) {
        await db.query('ROLLBACK');
        throw e;
    }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    const { user, isSuperAdmin } = await getCurrentSession();
    if (!user || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required.' }, { status: 403 });
    }

    try {
        const masterCourseId = parseInt(params.id, 10);
        if (isNaN(masterCourseId)) {
            return NextResponse.json({ error: 'Invalid master course ID.' }, { status: 400 });
        }

        const body = await request.json();
        const parsedBody = syncRequestSchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json({ error: 'Invalid request body.', details: parsedBody.error.flatten() }, { status: 400 });
        }
        const { targetSiteIds } = parsedBody.data;
        
        const db = await getDb();
        const masterCourseData = await getFullCourseDataFromMain(db, masterCourseId);
        
        const results = {
            success: [] as string[],
            failed: [] as string[],
        };

        for (const siteId of targetSiteIds) {
            try {
                await syncCourseToDb(db, siteId, masterCourseData);
                results.success.push(siteId);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error(`Failed to sync to site ${siteId}:`, message);
                results.failed.push(`Branch '${siteId}': ${message}`);
            }
        }

        if (results.failed.length > 0) {
            const message = `Sync completed with ${results.success.length} success(es) and ${results.failed.length} failure(s). Failures: ${results.failed.join(', ')}`;
            return NextResponse.json({ success: true, message: message, details: results.failed }, { status: 207 });
        }

        return NextResponse.json({ success: true, message: `Successfully synced course content to ${results.success.length} branch(es).` });

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown server error occurred during sync.";
        console.error("Course Sync Error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
