
'use server';
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/session';

const syncRequestSchema = z.object({
  targetSiteIds: z.array(z.string()).min(1, "At least one branch must be selected for sync."),
});

// Helper to get the complete, raw data for a course from the main DB.
async function getFullCourseDataFromMain(mainDb: any, courseId: number) {
    const course = await mainDb.get('SELECT * FROM courses WHERE id = ?', courseId);
    if (!course) {
        throw new Error('Master course not found in main branch.');
    }

    const modulesAndLessons = await mainDb.all(`
        SELECT 
            m.id as module_id, 
            m.title as module_title, 
            m."order" as module_order,
            l.id as lesson_id,
            l.title as lesson_title,
            l.type as lesson_type,
            l.content as lesson_content,
            l.imagePath as lesson_imagePath,
            l."order" as lesson_order
        FROM modules m
        LEFT JOIN lessons l ON m.id = l.module_id
        WHERE m.course_id = ?
        ORDER BY m."order" ASC, l."order" ASC
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
                imagePath: row.lesson_imagePath ?? null
            });
        }
    }
    course.modules = Array.from(modulesMap.values());
    
    const assignedSignatories = await mainDb.all('SELECT signatory_id FROM course_signatories WHERE course_id = ?', courseId);
    course.signatoryIds = assignedSignatories.map((s: any) => s.signatory_id);
    
    return course;
}

// Helper to apply the master course data to a target branch's DB.
async function syncCourseToDb(targetSiteId: string, masterCourseData: any) {
    const targetDb = await getDb(targetSiteId);
    
    const targetCourse = await targetDb.get('SELECT id, price FROM courses WHERE title = ?', masterCourseData.title);
    if (!targetCourse) {
        throw new Error(`Course "${masterCourseData.title}" not found in branch "${targetSiteId}".`);
    }
    const targetCourseId = targetCourse.id;
    
    await targetDb.run('BEGIN TRANSACTION');
    try {
        await targetDb.run(
            `UPDATE courses SET 
                description = ?, category = ?, imagePath = ?, venue = ?, 
                startDate = ?, endDate = ?, is_internal = ?, is_public = ?
             WHERE id = ?`,
            [
                masterCourseData.description, masterCourseData.category, masterCourseData.imagePath, masterCourseData.venue,
                masterCourseData.startDate, masterCourseData.endDate, masterCourseData.is_internal, masterCourseData.is_public,
                targetCourseId
            ]
        );

        const existingModules = await targetDb.all('SELECT id FROM modules WHERE course_id = ?', targetCourseId);
        if (existingModules.length > 0) {
            const existingModuleIds = existingModules.map((m: any) => m.id);
            const moduleIdsPlaceholder = existingModuleIds.map(() => '?').join(',');
            await targetDb.run(`DELETE FROM lessons WHERE module_id IN (${moduleIdsPlaceholder})`, existingModuleIds);
            await targetDb.run('DELETE FROM modules WHERE course_id = ?', targetCourseId);
        }
        
        for (const [moduleIndex, moduleData] of masterCourseData.modules.entries()) {
            const moduleResult = await targetDb.run('INSERT INTO modules (course_id, title, "order") VALUES (?, ?, ?)', [targetCourseId, moduleData.title, moduleIndex + 1]);
            const moduleId = moduleResult.lastID;
            if (!moduleId) throw new Error(`Failed to create module: ${moduleData.title}`);

            for (const [lessonIndex, lessonData] of moduleData.lessons.entries()) {
                await targetDb.run('INSERT INTO lessons (module_id, title, type, content, "order", imagePath) VALUES (?, ?, ?, ?, ?, ?)', [moduleId, lessonData.title, lessonData.type, lessonData.content, lessonIndex + 1, lessonData.imagePath]);
            }
        }

        await targetDb.run('DELETE FROM course_signatories WHERE course_id = ?', targetCourseId);
        if (masterCourseData.signatoryIds && masterCourseData.signatoryIds.length > 0) {
            const stmt = await targetDb.prepare('INSERT INTO course_signatories (course_id, signatory_id) VALUES (?, ?)');
            for (const signatoryId of masterCourseData.signatoryIds) {
                await stmt.run(targetCourseId, signatoryId);
            }
            await stmt.finalize();
        }
        
        await targetDb.run('COMMIT');
    } catch (e) {
        await targetDb.run('ROLLBACK');
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
        
        const mainDb = await getDb('main');
        const masterCourseData = await getFullCourseDataFromMain(mainDb, masterCourseId);
        
        const results = {
            success: [] as string[],
            failed: [] as string[],
        };

        for (const siteId of targetSiteIds) {
            try {
                await syncCourseToDb(siteId, masterCourseData);
                results.success.push(siteId);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error(`Failed to sync to site ${siteId}:`, message);
                results.failed.push(`Branch '${siteId}': ${message}`);
            }
        }

        if (results.failed.length > 0) {
            const message = `Sync completed with ${results.success.length} success(es) and ${results.failed.length} failure(s). Failures: ${results.failed.join(', ')}`;
            return NextResponse.json({ success: false, message }, { status: 207 }); // Multi-Status
        }

        return NextResponse.json({ success: true, message: `Successfully synced course content to ${results.success.length} branch(es).` });

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown server error occurred during sync.";
        console.error("Course Sync Error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
