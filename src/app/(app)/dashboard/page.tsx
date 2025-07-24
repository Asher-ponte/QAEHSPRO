
import { redirect } from 'next/navigation';

import { getCurrentSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { DashboardClient } from '@/components/dashboard-client';
import type { RowDataPacket } from 'mysql2';

async function getDashboardData() {
  const { user, siteId } = await getCurrentSession();
  if (!user || !siteId) {
    // This will be caught by the SessionProvider, but as a safeguard:
    redirect('/login');
  }
  const userId = user.id;

  try {
    const db = await getDb();

    // 1. Get stats which are independent of course enrollment.
    const [totalTrainingsResult] = await db.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM certificates WHERE user_id = ? AND type = ? AND site_id = ?',
      [userId, 'completion', siteId]
    );
    const totalTrainingsAttended = totalTrainingsResult[0]?.count ?? 0;

    const [totalRecognitionsResult] = await db.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM certificates WHERE user_id = ? AND type = ? AND site_id = ?',
      [userId, 'recognition', siteId]
    );
    const totalRecognitions = totalRecognitionsResult[0]?.count ?? 0;

    const [acquiredSkillsResult] = await db.query<RowDataPacket[]>(
        `SELECT DISTINCT c.category FROM certificates cert
         JOIN courses c ON cert.course_id = c.id
         WHERE cert.user_id = ? AND cert.type = 'completion' AND cert.site_id = ?`,
        [userId, siteId]
    );
    const skillsAcquiredCount = acquiredSkillsResult.length;
    
    const stats = {
        totalTrainingsAttended,
        totalRecognitions,
        skillsAcquired: skillsAcquiredCount,
    };

    // 2. Get all courses the user is enrolled in.
    const [enrolledCourses] = await db.query<RowDataPacket[]>(`
        SELECT 
            c.*
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE e.user_id = ? AND c.site_id = ?
    `, [userId, siteId]);

    // 3. CRITICAL FIX: If no courses, return early to prevent invalid queries later.
    if (enrolledCourses.length === 0) {
      return {
        stats: stats,
        courses: [],
      };
    }
    
    // 4. Get data for progress calculation of currently enrolled courses
    const courseIds = enrolledCourses.map(c => c.id);
    const courseIdsPlaceholder = courseIds.map(() => '?').join(',');

    const [allLessons] = await db.query<RowDataPacket[]>(`
        SELECT l.id, m.course_id
        FROM lessons l
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id IN (${courseIdsPlaceholder})
    `, courseIds);

    const [completedLessonIdsResult] = await db.query<RowDataPacket[]>(`
        SELECT up.lesson_id
        FROM user_progress up
        JOIN lessons l ON up.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE up.user_id = ? AND up.completed = 1 AND m.course_id IN (${courseIdsPlaceholder})
    `, [userId, ...courseIds]);
    const completedLessonIds = new Set(completedLessonIdsResult.map(r => r.lesson_id));

    const [passedAssessmentResult] = await db.query<RowDataPacket[]>(`
        SELECT course_id FROM final_assessment_attempts
        WHERE user_id = ? AND passed = 1 AND course_id IN (${courseIdsPlaceholder})
    `, [userId, ...courseIds]);
    const passedAssessmentIds = new Set(passedAssessmentResult.map(r => r.course_id));


    // 5. Process the data in memory for course list.
    const lessonsByCourse = allLessons.reduce((acc, l) => {
        if (!acc[l.course_id]) acc[l.course_id] = [];
        acc[l.course_id].push(l);
        return acc;
    }, {} as Record<number, typeof allLessons>);
    
    const myCourses = enrolledCourses.map(course => {
        const courseLessons = lessonsByCourse[course.id] || [];
        const totalLessons = courseLessons.length;
        const completedLessonsCount = courseLessons.filter(l => completedLessonIds.has(l.id)).length;
        const hasFinalAssessment = !!course.final_assessment_content;

        let progress = 0;
        if (totalLessons > 0) {
            progress = Math.floor((completedLessonsCount / totalLessons) * 100);
        }
        
        // If course has an assessment, progress is not 100% unless it's passed.
        // Cap progress at 99% if lessons are done but assessment is not.
        if (hasFinalAssessment && progress === 100 && !passedAssessmentIds.has(course.id)) {
            progress = 99;
        }

        const firstUncompletedLesson = courseLessons.find(l => !completedLessonIds.has(l.id));
        let continueLessonId: number | null = firstUncompletedLesson?.id || courseLessons[0]?.id || null;
        
        // If all lessons are complete and there's an assessment, link should point to assessment page.
        if (hasFinalAssessment && completedLessonsCount === totalLessons) {
            continueLessonId = null; // Special value to indicate going to assessment page
        }

        return {
            id: course.id,
            title: course.title,
            category: course.category,
            imagePath: course.imagePath,
            progress: progress,
            continueLessonId: continueLessonId,
        };
    });
    
    return {
      stats: stats,
      courses: myCourses,
    };

  } catch (error) {
    console.error('Error fetching dashboard data on server:', error);
    // Return empty state on error to avoid crashing the page.
    return { stats: { totalTrainingsAttended: 0, totalRecognitions: 0, skillsAcquired: 0 }, courses: [] };
  }
}

export default async function DashboardPage() {
    const { stats, courses } = await getDashboardData();
    return <DashboardClient stats={stats} courses={courses} />;
}
