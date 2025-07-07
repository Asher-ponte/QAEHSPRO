
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentSession } from '@/lib/session';
import { getAllSites } from '@/lib/sites';

// Helper function to compute statistics for a list of courses against a specific database.
async function getCourseStats(db: any, courses: any[]) {
    if (courses.length === 0) {
        return [];
    }

    const courseIds = courses.map(c => c.id);
    const placeholders = courseIds.map(() => '?').join(',');

    const lessonsPerCourseResult = await db.all(`
        SELECT m.course_id, COUNT(l.id) as totalLessons
        FROM lessons l
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id IN (${placeholders})
        GROUP BY m.course_id
    `, courseIds);
    const lessonsPerCourse = new Map(lessonsPerCourseResult.map(i => [i.course_id, i.totalLessons]));

    const enrollmentsResult = await db.all(`SELECT user_id, course_id FROM enrollments WHERE course_id IN (${placeholders})`, courseIds);
    const enrollmentsByCourse: Record<number, number[]> = {};
    for (const e of enrollmentsResult) {
        if (!enrollmentsByCourse[e.course_id]) {
            enrollmentsByCourse[e.course_id] = [];
        }
        enrollmentsByCourse[e.course_id].push(e.user_id);
    }
    
    const completedLessonsResult = await db.all(`
        SELECT m.course_id, up.user_id, COUNT(up.lesson_id) as completedLessons
        FROM user_progress up
        JOIN lessons l ON up.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE up.completed = 1 AND m.course_id IN (${placeholders})
        GROUP BY m.course_id, up.user_id
    `, courseIds);
    const completedLessonsMap = new Map<string, number>(); // key: 'courseId-userId'
    completedLessonsResult.forEach(r => {
        completedLessonsMap.set(`${r.course_id}-${r.user_id}`, r.completedLessons);
    });
    
    return courses.map(course => {
        const totalLessons = lessonsPerCourse.get(course.id) || 0;
        const enrolledUsers = enrollmentsByCourse[course.id] || [];
        const enrolledCount = enrolledUsers.length;

        let completedUserCount = 0;
        if (totalLessons > 0 && enrolledCount > 0) {
            for (const userId of enrolledUsers) {
                const completedCount = completedLessonsMap.get(`${course.id}-${userId}`) || 0;
                if (completedCount === totalLessons) {
                    completedUserCount++;
                }
            }
        }
        
        const completionRate = enrolledCount > 0 ? Math.round((completedUserCount / enrolledCount) * 100) : 0;
        
        return {
            ...course,
            enrolledCount,
            completionRate
        };
    });
}


export async function GET() {
  const { user, siteId, isSuperAdmin } = await getCurrentSession();
  if (user?.role !== 'Admin' || !siteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const db = await getDb(siteId);
    let courses = await db.all(`SELECT id, title, category, startDate, endDate, is_internal, is_public, price FROM courses ORDER BY title ASC`);

    if (isSuperAdmin && siteId === 'main') {
        const allSites = await getAllSites();
        const otherSites = allSites.filter(s => s.id !== 'main');
        
        const coursesWithPublishedData = await Promise.all(courses.map(async (course) => {
            const publishedTo = [];
            for (const otherSite of otherSites) {
                try {
                    const otherDb = await getDb(otherSite.id);
                    const foundCourse = await otherDb.get('SELECT id FROM courses WHERE title = ?', course.title);
                    if (foundCourse) {
                        publishedTo.push(otherSite.name);
                    }
                } catch (e) {
                    console.error(`Error checking for course '${course.title}' in site '${otherSite.id}':`, e);
                }
            }
            return { ...course, publishedTo };
        }));
        courses = coursesWithPublishedData;
    }
    
    const coursesWithCompletion = await getCourseStats(db, courses);
    return NextResponse.json(coursesWithCompletion)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch courses for admin' }, { status: 500 })
  }
}
