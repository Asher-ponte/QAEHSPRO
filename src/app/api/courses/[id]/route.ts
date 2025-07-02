
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/session';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb()
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const userId = user.id;
    const courseId = params.id;

    const course = await db.get('SELECT * FROM courses WHERE id = ?', courseId)
    
    if (!course) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    if (user.role !== 'Admin') {
        const enrollment = await db.get('SELECT user_id FROM enrollments WHERE user_id = ? AND course_id = ?', [userId, courseId]);
        if (!enrollment) {
            return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
        }
    }
    
    // Check for refresher status by comparing the latest certificate date with the course end date.
    const latestCertificate = await db.get(
        'SELECT completion_date FROM certificates WHERE user_id = ? AND course_id = ? ORDER BY completion_date DESC LIMIT 1',
        [userId, courseId]
    );

    const isRefresher = latestCertificate && course.endDate && new Date(course.endDate) > new Date(latestCertificate.completion_date);

    // If it's a refresher course, wipe the user's progress for this course to restart it.
    if (isRefresher) {
        const modulesForCourse = await db.all('SELECT id FROM modules WHERE course_id = ?', courseId);
        const moduleIds = modulesForCourse.map(m => m.id);

        if (moduleIds.length > 0) {
            const lessonsForModules = await db.all(`SELECT id FROM lessons WHERE module_id IN (${moduleIds.map(() => '?').join(',')})`, moduleIds);
            const lessonIds = lessonsForModules.map(l => l.id);

            if (lessonIds.length > 0) {
                await db.run(`DELETE FROM user_progress WHERE user_id = ? AND lesson_id IN (${lessonIds.map(() => '?').join(',')})`, [userId, ...lessonIds]);
            }
        }
    }


    // Fetch all modules and lessons in one go, including modules without lessons
    const modulesAndLessons = await db.all(
        `SELECT 
            m.id as module_id, 
            m.title as module_title, 
            m."order" as module_order,
            l.id as lesson_id, 
            l.title as lesson_title, 
            l.type as lesson_type, 
            l."order" as lesson_order,
            CASE WHEN up.completed = 1 THEN 1 ELSE 0 END as completed
        FROM modules m
        LEFT JOIN lessons l ON m.id = l.module_id
        LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = ?
        WHERE m.course_id = ? 
        ORDER BY m."order" ASC, l."order" ASC`,
        [userId, courseId]
    );

    // Determine course completion status *after* potential progress reset
    const allLessonsInCourse = modulesAndLessons.filter(ml => ml.lesson_id);
    const completedLessons = allLessonsInCourse.filter(l => l.completed);
    const isCourseCompleted = allLessonsInCourse.length > 0 && allLessonsInCourse.length === completedLessons.length;


    const courseDetail = { ...course, modules: [] as any[], isCompleted: isCourseCompleted };

    // Process the flat list into a nested structure
    const modulesMap = new Map<number, any>();
    for (const row of modulesAndLessons) {
        if (!modulesMap.has(row.module_id)) {
            modulesMap.set(row.module_id, {
                id: row.module_id,
                title: row.module_title,
                lessons: []
            });
        }
        if (row.lesson_id) { // Only add lesson if it exists
            modulesMap.get(row.module_id).lessons.push({
                id: row.lesson_id,
                title: row.lesson_title,
                type: row.lesson_type,
                completed: !!row.completed
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

