

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { user, siteId } = await getCurrentSession();
  if (!user || !siteId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const db = await getDb();

    const userId = user.id;
    const courseId = parseInt(params.id, 10);

    if (isNaN(courseId)) {
        return NextResponse.json({ error: 'Invalid course ID.' }, { status: 400 });
    }

    const [courseRows] = await db.query<RowDataPacket[]>('SELECT * FROM courses WHERE id = ? AND site_id = ?', [courseId, siteId]);
    const course = courseRows[0];
    
    if (!course) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    // Access control logic
    if (user.role !== 'Admin') {
        if (user.type === 'External' && !course.is_public) {
            return NextResponse.json({ error: 'This course is not available to you.' }, { status: 403 });
        }
        if (user.type === 'Employee' && !course.is_internal && !course.is_public) {
            return NextResponse.json({ error: 'This course is not available to you.' }, { status: 403 });
        }
    }
    
    // Nullify price for non-external users to enforce free access for them.
    if (user.type !== 'External') {
        course.price = null;
    }

    const [modulesAndLessons] = await db.query<RowDataPacket[]>(
        `SELECT 
            m.id as module_id, 
            m.title as module_title, 
            m.order as module_order,
            l.id as lesson_id, 
            l.title as lesson_title, 
            l.type as lesson_type, 
            l.order as lesson_order
        FROM modules m
        LEFT JOIN lessons l ON m.id = l.module_id
        WHERE m.course_id = ? 
        ORDER BY m.order ASC, l.order ASC`,
        [courseId]
    );

    const allLessonIds = modulesAndLessons.filter((l: any) => l.lesson_id).map((l: any) => l.lesson_id);
    let completedLessonIds = new Set<number>();
    if (allLessonIds.length > 0) {
        const [progressResults] = await db.query<RowDataPacket[]>(
            `SELECT lesson_id FROM user_progress WHERE user_id = ? AND lesson_id IN (?) AND completed = 1`,
            [userId, allLessonIds]
        );
        completedLessonIds = new Set(progressResults.map((r: any) => r.lesson_id));
    }
    
    const [certRows] = await db.query<RowDataPacket[]>('SELECT id FROM certificates WHERE user_id = ? AND course_id = ?', [userId, courseId]);
    const isCourseCompleted = certRows.length > 0;
    const allLessonsCompleted = allLessonIds.length > 0 && allLessonIds.length === completedLessonIds.size;
    const hasFinalAssessment = !!course.final_assessment_content;

    let transactionStatus: { status: string, reason: string | null } | null = null;
    if (user.type === 'External') {
        const [transactionRows] = await db.query<RowDataPacket[]>(
            `SELECT status, rejection_reason FROM transactions WHERE user_id = ? AND course_id = ? ORDER BY transaction_date DESC LIMIT 1`,
            [userId, courseId]
        );
        const transaction = transactionRows[0];
        if (transaction) {
            transactionStatus = { status: transaction.status, reason: transaction.rejection_reason };
        }
    }

    const courseDetail = { 
        ...course, 
        modules: [] as any[], 
        isCompleted: isCourseCompleted,
        allLessonsCompleted: allLessonsCompleted,
        hasFinalAssessment: hasFinalAssessment,
        transactionStatus: transactionStatus,
    };

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
                completed: completedLessonIds.has(row.lesson_id)
            });
        }
    }
    
    courseDetail.modules = Array.from(modulesMap.values());

    if (courseDetail.modules.length === 0) {
      courseDetail.modules.push({
          id: -1,
          title: "Module 1: Coming Soon",
          lessons: [
            { id: -1, title: "Course content is being prepared.", type: "document", completed: false },
          ],
        },)
    }

    return NextResponse.json(courseDetail)
  } catch (error) {
    console.error(`Error fetching course ${params.id}:`, error)
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ error: 'Failed to fetch course', details: errorMessage }, { status: 500 })
  }
}
