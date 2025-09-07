

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';
import type { RowDataPacket } from 'mysql2';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { user, siteId: sessionSiteId, isSuperAdmin } = await getCurrentSession();
    if (user?.role !== 'Admin' || !sessionSiteId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const searchParams = request.nextUrl.searchParams;
        const targetSiteId = searchParams.get('targetSiteId');
        const courseTitle = searchParams.get('courseTitle');
        
        let effectiveSiteId = sessionSiteId;
        let effectiveCourseId = parseInt(params.id, 10);
        
        const db = await getDb();

        if (isSuperAdmin && targetSiteId && courseTitle) {
            effectiveSiteId = targetSiteId;
            const [courseRows] = await db.query<RowDataPacket[]>('SELECT id FROM courses WHERE title = ? AND site_id = ?', [courseTitle, effectiveSiteId]);
            const course = courseRows[0];
            if (!course) {
                // If the course with that title doesn't exist in the target branch, return empty progress.
                return NextResponse.json([]); 
            }
            effectiveCourseId = course.id;
        }

        if (isNaN(effectiveCourseId)) {
            return NextResponse.json({ error: 'Invalid Course ID provided.'}, { status: 400 });
        }
        
        const [courseRows] = await db.query<RowDataPacket[]>(`SELECT final_assessment_content FROM courses WHERE id = ?`, [effectiveCourseId]);
        const courseData = courseRows[0];
        const hasFinalAssessment = !!courseData?.final_assessment_content;

        // Get total number of lessons for the course
        const [totalLessonsRows] = await db.query<RowDataPacket[]>(`
            SELECT COUNT(l.id) as count
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            WHERE m.course_id = ?
        `, [effectiveCourseId]);
        const totalLessons = totalLessonsRows[0]?.count ?? 0;

        // Get all enrolled users for the course
        const [enrolledUsers] = await db.query<RowDataPacket[]>(`
            SELECT u.id, u.username, u.fullName, u.department
            FROM users u
            JOIN enrollments e ON u.id = e.user_id
            WHERE e.course_id = ?
        `, [effectiveCourseId]);

        if (enrolledUsers.length === 0) {
            return NextResponse.json([]);
        }

        if (totalLessons === 0 && !hasFinalAssessment) {
            return NextResponse.json(enrolledUsers.map(u => ({
                id: u.id,
                username: u.username,
                fullName: u.fullName || u.username,
                department: u.department || 'N/A',
                progress: 0,
                completionDate: null,
            })));
        }
        
        const enrolledUserIds = enrolledUsers.map(u => u.id);

        // Get progress for each enrolled user
        const [completedLessonsRows] = await db.query<RowDataPacket[]>(`
            SELECT up.user_id, COUNT(up.lesson_id) as count
            FROM user_progress up
            JOIN lessons l ON up.lesson_id = l.id
            JOIN modules m ON l.module_id = m.id
            WHERE up.user_id IN (?) AND m.course_id = ? AND up.completed = 1
            GROUP BY up.user_id
        `, [enrolledUserIds, effectiveCourseId]);
        
        const completedLessonsMap = new Map<number, number>();
        completedLessonsRows.forEach(row => {
            completedLessonsMap.set(row.user_id, row.count);
        });
        
        const [passedAssessmentRows] = await db.query<RowDataPacket[]>(
            `SELECT user_id FROM final_assessment_attempts WHERE user_id IN (?) AND course_id = ? AND passed = 1`,
            [enrolledUserIds, effectiveCourseId]
        );
        const passedAssessmentUserIds = new Set(passedAssessmentRows.map(row => row.user_id));

        const [certificateRows] = await db.query<RowDataPacket[]>(
            `SELECT user_id, completion_date FROM certificates WHERE user_id IN (?) AND course_id = ? AND type = 'completion'`,
            [enrolledUserIds, effectiveCourseId]
        );
        const completionDateMap = new Map<number, string>();
        certificateRows.forEach(row => {
            completionDateMap.set(row.user_id, row.completion_date);
        });


        const progressData = enrolledUsers.map(user => {
            const completedLessons = completedLessonsMap.get(user.id) || 0;
            let progress = 0;
            
            if (hasFinalAssessment) {
                if (passedAssessmentUserIds.has(user.id)) {
                    progress = 100;
                } else {
                    // Cap at 99 if all lessons are done but assessment isn't
                    const lessonProgress = totalLessons > 0 ? Math.floor((completedLessons / totalLessons) * 100) : 0;
                    progress = Math.min(99, lessonProgress);
                }
            } else {
                 progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
            }

            return {
                id: user.id,
                username: user.username,
                fullName: user.fullName || user.username,
                department: user.department || 'N/A',
                progress: progress,
                completionDate: completionDateMap.get(user.id) || null,
            };
        });

        return NextResponse.json(progressData);

    } catch (error) {
        console.error("Failed to fetch course progress:", error);
        return NextResponse.json({ error: 'Failed to fetch course progress' }, { status: 500 });
    }
}
