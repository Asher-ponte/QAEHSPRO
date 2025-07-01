
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const db = await getDb()
    const cookieStore = cookies()
    const sessionId = cookieStore.get('session')?.value

    if (!sessionId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const userId = parseInt(sessionId, 10);

    // --- Fetch all relevant data in simple queries ---
    const allCourses = await db.all('SELECT * FROM courses');
    const allModules = await db.all('SELECT id, course_id FROM modules');
    const allLessons = await db.all('SELECT id, module_id FROM lessons');
    const userProgress = await db.all('SELECT lesson_id FROM user_progress WHERE user_id = ? AND completed = 1', userId);
    
    const completedLessonIds = new Set(userProgress.map(p => p.lesson_id));

    // --- Process data in JavaScript for robustness ---

    // 1. Map data for easier lookup
    const courseToModules: { [courseId: number]: number[] } = {};
    for (const module of allModules) {
        if (!courseToModules[module.course_id]) {
            courseToModules[module.course_id] = [];
        }
        courseToModules[module.course_id].push(module.id);
    }
    
    const moduleToLessons: { [moduleId: number]: number[] } = {};
    for (const lesson of allLessons) {
        if (!moduleToLessons[lesson.module_id]) {
            moduleToLessons[lesson.module_id] = [];
        }
        moduleToLessons[lesson.module_id].push(lesson.id);
    }

    let coursesCompleted = 0;
    const skillsAcquired = new Set<string>();
    const coursesWithProgress = [];

    // 2. Process each course
    for (const course of allCourses) {
        const courseModuleIds = courseToModules[course.id] || [];
        if (courseModuleIds.length === 0) {
            continue; // Skip courses with no modules
        }

        let totalLessonsInCourse = 0;
        let completedLessonsInCourse = 0;

        for (const moduleId of courseModuleIds) {
            const lessonIdsInModule = moduleToLessons[moduleId] || [];
            totalLessonsInCourse += lessonIdsInModule.length;
            for (const lessonId of lessonIdsInModule) {
                if (completedLessonIds.has(lessonId)) {
                    completedLessonsInCourse++;
                }
            }
        }

        if (totalLessonsInCourse === 0) {
            continue; // Skip courses with no lessons
        }

        // 3. Calculate stats for this course
        if (completedLessonsInCourse === totalLessonsInCourse) {
            coursesCompleted++;
            skillsAcquired.add(course.category);
        }
        
        // 4. Calculate progress for "My Courses" list
        if (completedLessonsInCourse > 0) {
            const progress = Math.floor((completedLessonsInCourse / totalLessonsInCourse) * 100);
            if (progress < 100) {
                coursesWithProgress.push({ ...course, progress });
            }
        }
    }

    return NextResponse.json({
        stats: {
            coursesCompleted,
            skillsAcquired: skillsAcquired.size,
        },
        myCourses: coursesWithProgress.slice(0, 3),
    });

  } catch (error) {
    console.error('Error in /api/dashboard:', error);
    return NextResponse.json({ error: 'An unexpected error occurred while fetching dashboard data.' }, { status: 500 })
  }
}
