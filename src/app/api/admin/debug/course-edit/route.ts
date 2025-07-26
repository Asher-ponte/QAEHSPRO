
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import { z } from 'zod';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const courseEditTestSchema = z.object({
  courseId: z.number(),
  newTitle: z.string().min(1),
  publishToSiteIds: z.array(z.string()).optional(),
});

function transformQuestionsToDbFormat(questions: any[]) {
    if (!questions || !Array.isArray(questions)) return null;
    return JSON.stringify(questions.map(q => ({
        text: q.text,
        options: q.options.map((opt: { text: string }, index: number) => ({
            text: opt.text,
            isCorrect: index === q.correctOptionIndex,
        })),
    })));
}

async function getFullCourseData(db: any, courseId: number) {
    const [courseRows] = await db.query<RowDataPacket[]>('SELECT * FROM courses WHERE id = ?', [courseId]);
    const course = courseRows[0];
    if (!course) throw new Error(`Course with ID ${courseId} not found.`);
    
    const [modulesAndLessons] = await db.query<RowDataPacket[]>(`
        SELECT m.*, l.id as lesson_id, l.title as lesson_title, l.type as lesson_type, l.content as lesson_content, l.imagePath as lesson_imagePath, l.documentPath as lesson_documentPath
        FROM modules m LEFT JOIN lessons l ON m.id = l.module_id WHERE m.course_id = ? ORDER BY m.order, l.order
    `, [courseId]);
    
    const modulesMap: Map<number, any> = new Map();
    modulesAndLessons.forEach(row => {
        if (!modulesMap.has(row.id)) {
            modulesMap.set(row.id, {
                id: row.id,
                title: row.title,
                lessons: []
            });
        }
        if (row.lesson_id) {
            modulesMap.get(row.id).lessons.push({
                id: row.lesson_id,
                title: row.lesson_title,
                type: row.lesson_type,
                content: row.lesson_content,
                imagePath: row.lesson_imagePath,
                documentPath: row.lesson_documentPath,
                questions: row.type === 'quiz' ? JSON.parse(row.content || '[]') : []
            });
        }
    });
    course.modules = Array.from(modulesMap.values());

    const [signatories] = await db.query<RowDataPacket[]>('SELECT signatory_id FROM course_signatories WHERE course_id = ?', [courseId]);
    course.signatoryIds = signatories.map(s => s.signatory_id);
    
    return course;
}

export async function POST(request: NextRequest) {
    const { user: adminUser, isSuperAdmin } = await getCurrentSession();
    if (!adminUser || !isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required.' }, { status: 403 });
    }

    const db = await getDb();
    let simulationLog: any = {};

    try {
        await db.query('START TRANSACTION');
        simulationLog.transaction = 'started';
        
        const body = await request.json();
        const parsedBody = courseEditTestSchema.safeParse(body);
        if (!parsedBody.success) {
            throw new Error(`Invalid request body: ${JSON.stringify(parsedBody.error.flatten())}`);
        }
        
        const { courseId, newTitle, publishToSiteIds } = parsedBody.data;
        simulationLog.request_body = { courseId, newTitle, publishToSiteIds };

        // 1. Fetch full master course data
        const masterCourseData = await getFullCourseData(db, courseId);
        simulationLog.fetch_master_course = { status: 'success', data: 'omitted for brevity' };

        // 2. Simulate updating the master course
        await db.query('UPDATE courses SET title = ? WHERE id = ?', [newTitle, courseId]);
        simulationLog.update_master_course = { status: 'success', newTitle: newTitle };
        
        // 3. Simulate publishing to new branches
        simulationLog.publish_to_branches = {};
        if (publishToSiteIds && publishToSiteIds.length > 0) {
            for (const siteId of publishToSiteIds) {
                const coursePrice = siteId === 'external' ? masterCourseData.price : null;
                const [courseResult] = await db.query<ResultSetHeader>(
                    `INSERT INTO courses (site_id, title, description, category, imagePath, venue, startDate, endDate, is_internal, is_public, price, final_assessment_content, final_assessment_passing_rate, final_assessment_max_attempts)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [siteId, masterCourseData.title, masterCourseData.description, masterCourseData.category, masterCourseData.imagePath, masterCourseData.venue, masterCourseData.startDate, masterCourseData.endDate, masterCourseData.is_internal, masterCourseData.is_public, coursePrice, masterCourseData.final_assessment_content, masterCourseData.final_assessment_passing_rate, masterCourseData.final_assessment_max_attempts]
                );
                const newCourseId = courseResult.insertId;
                simulationLog.publish_to_branches[siteId] = { status: 'success', newCourseId: newCourseId };
            }
        }
        
        await db.query('ROLLBACK');
        simulationLog.transaction = 'rolled_back';

        return NextResponse.json({
            message: "Simulation successful. All changes were rolled back.",
            simulation: simulationLog,
        });

    } catch (error) {
        await db.query('ROLLBACK').catch(e => {
            simulationLog.rollback_on_error = `failed: ${e.message}`;
        });
        simulationLog.transaction = 'rolled_back_on_error';

        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error("[DEBUG] Course Edit Test Failed:", error);
        
        simulationLog.error = {
            message: errorMessage,
            stack: errorStack,
        };

        return NextResponse.json({ 
            error: 'Test failed during execution.', 
            details: errorMessage,
            simulation: simulationLog,
        }, { status: 500 });
    }
}
