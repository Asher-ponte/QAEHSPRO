

'use server';

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

async function hasAccess(db: any, user: any, courseId: number) {
    if (user.role === 'Admin') return true;
    
    // Check for direct enrollment
    const [enrollmentRows] = await db.query<RowDataPacket[]>('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [user.id, courseId]);
    if (enrollmentRows.length > 0) {
        return true;
    }
    
    // For external users, also check for a valid transaction
    if (user.type === 'External') {
        const [transactionRows] = await db.query<RowDataPacket[]>(
            `SELECT id FROM transactions WHERE user_id = ? AND course_id = ? AND status IN ('pending', 'completed')`,
            [user.id, courseId]
        );
        if (transactionRows.length > 0) {
            return true;
        }
    }

    return false;
}

export async function GET(
    request: NextRequest, 
    { params }: { params: { id: string } }
) {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = await getDb();
    const courseId = parseInt(params.id, 10);

    if (isNaN(courseId)) {
        return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
    }
    
    const canAccess = await hasAccess(db, user, courseId);
    if (!canAccess) {
        return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
    }

    try {
        const [courseRows] = await db.query<RowDataPacket[]>('SELECT * FROM courses WHERE id = ?', [courseId]);
        const course = courseRows[0];

        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        const [modulesAndLessons] = await db.query<RowDataPacket[]>(`
            SELECT m.id as module_id, m.title, l.id as lesson_id, l.title as lesson_title, l.type as lesson_type,
                   (SELECT COUNT(*) > 0 FROM user_progress up WHERE up.lesson_id = l.id AND up.user_id = ? AND up.completed = 1) as completed
            FROM modules m
            LEFT JOIN lessons l ON m.id = l.module_id
            WHERE m.course_id = ?
            ORDER BY m.\`order\` ASC, l.\`order\` ASC
        `, [user.id, courseId]);

        const modulesMap = new Map<number, any>();
        for (const row of modulesAndLessons) {
            if (!modulesMap.has(row.module_id)) {
                modulesMap.set(row.module_id, {
                    id: row.module_id,
                    title: row.title,
                    lessons: []
                });
            }
            if (row.lesson_id) {
                modulesMap.get(row.module_id).lessons.push({
                    id: row.lesson_id,
                    title: row.lesson_title,
                    type: row.lesson_type,
                    completed: !!row.completed
                });
            }
        }
        
        // Check if user has passed the final assessment
        const [passedAssessmentRows] = await db.query<RowDataPacket[]>(
            `SELECT course_id FROM final_assessment_attempts WHERE user_id = ? AND course_id = ? AND passed = 1`,
            [user.id, courseId]
        );
        const hasPassedAssessment = passedAssessmentRows.length > 0;
        
        const totalLessons = modulesAndLessons.filter(ml => ml.lesson_id).length;
        const completedLessons = modulesAndLessons.filter(ml => ml.completed).length;
        const allLessonsCompleted = totalLessons > 0 && completedLessons >= totalLessons;

        let transactionStatus = null;
        if (user.type === 'External') {
            const [transactionRows] = await db.query<RowDataPacket[]>(`SELECT status, rejection_reason FROM transactions WHERE user_id = ? AND course_id = ? ORDER BY transaction_date DESC LIMIT 1`, [user.id, courseId]);
            if (transactionRows.length > 0) {
                transactionStatus = { status: transactionRows[0].status, reason: transactionRows[0].rejection_reason };
            }
        }

        return NextResponse.json({
            id: course.id,
            title: course.title,
            description: course.description,
            imagePath: course.imagePath,
            startDate: course.startDate,
            endDate: course.endDate,
            is_public: !!course.is_public,
            price: course.price,
            modules: Array.from(modulesMap.values()),
            isCompleted: hasPassedAssessment,
            hasFinalAssessment: !!course.final_assessment_content,
            allLessonsCompleted: allLessonsCompleted,
            transactionStatus: transactionStatus,
        });

    } catch (error) {
        console.error("Failed to fetch course details:", error);
        return NextResponse.json({ error: 'Failed to fetch course details' }, { status: 500 });
    }
}
