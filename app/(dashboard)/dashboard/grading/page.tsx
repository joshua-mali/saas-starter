import { getTeacherClasses, getTeamClasses, getUserTeam } from '@/app/actions/get-classes'; // Import new actions
import { db } from '@/lib/db/drizzle';
import {
    classCurriculumPlan,
    classes,
    classTeachers,
    gradeScales as gradeScalesTable,
    studentAssessments,
    studentEnrollments,
    terms as termsTable,
    type Class,
    type ClassCurriculumPlanItem,
    type GradeScale,
    type Stage,
    type Student,
    type StudentAssessment,
    type StudentEnrollment,
    type Term
} from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { and, eq, inArray } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import GradingTableClient from './client'; // Import the client component

// --- Helper Functions ---

function getCurrentWeekStartDate(): Date {
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday = 0, Monday = 1, ...
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0); // Normalize time
    return monday;
}

// Helper function to format dates consistently
const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    // Ensure we handle potential timezone offsets correctly when getting YYYY-MM-DD
    // One way is to use UTC methods
    const year = d.getUTCFullYear();
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = d.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper to get weeks between two dates
function getWeeksBetween(startDate: Date, endDate: Date): Date[] {
    const weeks: Date[] = [];
    // const termStartDate = new Date(startDate); // Don't need this extra variable now
    // termStartDate.setHours(0, 0, 0, 0);

    // Calculate the Monday of the week the term starts in
    let currentMonday = new Date(startDate);
    const dayOfWeek = currentMonday.getDay();
    const diff = currentMonday.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    currentMonday = new Date(currentMonday.setDate(diff));
    currentMonday.setHours(0, 0, 0, 0);

    const finalEndDate = new Date(endDate);
    finalEndDate.setHours(0, 0, 0, 0);

    while (currentMonday <= finalEndDate) {
        // Remove the filtering condition - always add the Monday within the loop range
        // if (currentMonday.getTime() >= termStartDate.getTime()) { 
        weeks.push(new Date(currentMonday));
        // }
        // Increment to the next Monday
        currentMonday.setDate(currentMonday.getDate() + 7);
    }
    return weeks;
}

// --- Data Fetching Functions ---

// Updated function to include authorization check
async function checkTeacherAuthorization(classId: string, userId: string): Promise<boolean> {
    const teacherLink = await db.query.classTeachers.findFirst({
        where: and(
            eq(classTeachers.classId, classId),
            eq(classTeachers.teacherId, userId)
        ),
        columns: { id: true } // Only need to know if it exists
    });
    return !!teacherLink;
}

// TODO: Refactor with Planning page fetch if identical (or create shared util)
async function getClassDetails(classId: string, userId: string): Promise<(Class & { stage: Stage | null, teamId: number }) | null> {
    // Authorization is checked separately now, so we just fetch the details
    const result = await db.query.classes.findFirst({
        where: eq(classes.id, classId),
        with: {
            stage: true,
        }
    });
    // Ensure teamId is returned if needed elsewhere
    return result ? { ...result, teamId: result.teamId } : null;
}

// OPTIMIZED: Single query to get all grading data
async function getGradingData(
    classId: string,
    teamId: number,
    calendarYear: number,
    weekStartDate: Date
): Promise<{
    students: (StudentEnrollment & { student: Student })[];
    gradeScales: GradeScale[];
    plannedItems: (ClassCurriculumPlanItem & { contentGroup: { name: string } })[];
    assessments: StudentAssessment[];
    terms: Term[];
}> {
    // Execute all queries in parallel for better performance
    const [studentsResult, gradeScalesResult, plannedItemsResult, termsResult] = await Promise.all([
        // Get students for this class
        db.query.studentEnrollments.findMany({
            where: and(
                eq(studentEnrollments.classId, classId),
                eq(studentEnrollments.status, 'active')
            ),
            with: {
                student: true,
            },
            orderBy: (enrollments, { asc }) => [asc(enrollments.studentId)],
        }),

        // Get grade scales - FIXED: Filter by specific class ID to show only scales for this class
        db.select().from(gradeScalesTable)
            .where(eq(gradeScalesTable.classId, classId))
            .orderBy(gradeScalesTable.numericValue),

        // Get planned items for the week
        db.query.classCurriculumPlan.findMany({
            where: and(
                eq(classCurriculumPlan.classId, classId),
                eq(classCurriculumPlan.weekStartDate, weekStartDate)
            ),
            with: {
                contentGroup: {
                    columns: { name: true }
                }
            },
            orderBy: (planItems, { asc }) => [asc(planItems.contentGroupId)],
        }),

        // Get terms for the year
        db.select().from(termsTable)
            .where(and(eq(termsTable.teamId, teamId), eq(termsTable.calendarYear, calendarYear)))
            .orderBy(termsTable.termNumber)
    ]);

    // Get assessments only if we have students and planned items
    let assessments: StudentAssessment[] = [];
    if (studentsResult.length > 0 && plannedItemsResult.length > 0) {
        assessments = await db.select().from(studentAssessments)
            .where(and(
                inArray(studentAssessments.studentEnrollmentId, studentsResult.map(s => s.id)),
                eq(studentAssessments.assessmentDate, weekStartDate)
            ));
    }

    return {
        students: studentsResult,
        gradeScales: gradeScalesResult,
        plannedItems: plannedItemsResult,
        assessments,
        terms: termsResult
    };
}

// --- Page Component Props Interface ---
interface GradingPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// --- Page Component (Use standard destructuring) ---

export default async function GradingPage({ searchParams: searchParamsPromise }: GradingPageProps) {
    console.log('[GradingPage] Starting render');
    
    const searchParams = await searchParamsPromise;
    const rawClassId = Array.isArray(searchParams.classId) ? searchParams.classId[0] : searchParams.classId;
    const weekParam = Array.isArray(searchParams.week) ? searchParams.week[0] : searchParams.week;
    const wasWeekRequested = !!weekParam;

    console.log('[GradingPage] Search params:', { rawClassId, weekParam, wasWeekRequested });

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error('[GradingPage] Auth error:', authError);
        redirect('/sign-in');
    }

    console.log('[GradingPage] User authenticated:', user.id);

    const userTeamId = await getUserTeam(user.id);
    if (!userTeamId) {
        console.error("[GradingPage] User is not part of any team.");
        return <div>Error: You are not part of a team.</div>;
    }

    console.log('[GradingPage] User team ID:', userTeamId);

    try {
        const [userTaughtClasses, allTeamClasses] = await Promise.all([
            getTeacherClasses(user.id),
            getTeamClasses(userTeamId)
        ]);

        console.log('[GradingPage] Classes loaded:', {
            userTaughtCount: userTaughtClasses.length,
            teamClassesCount: allTeamClasses.length
        });

        let classId: string | null = null;
        if (rawClassId) {
            if (allTeamClasses.some(c => c.id === rawClassId)) {
                classId = rawClassId;
            } else {
                console.warn(`[GradingPage] Invalid or unauthorized classId requested: ${rawClassId}.`);
            }
        }
        if (classId === null && userTaughtClasses.length > 0) {
            classId = userTaughtClasses[0].id;
        }
        if (classId === null) {
            console.log('[GradingPage] No valid class found');
            return (
                <div className="p-4 text-center">
                    <p>Please select a class from the dropdown above to view the grading board.</p>
                    {allTeamClasses.length > 0 ? (
                        <p className="text-sm text-muted-foreground mt-2">
                            (You can select any class associated with your team.)
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground mt-2">
                            (No classes found for your team.)
                        </p>
                    )}
                </div>
            );
        }

        console.log('[GradingPage] Selected class ID:', classId);

        // Determine the target week
        let targetWeekString: string;
        if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
            targetWeekString = weekParam;
        } else {
            targetWeekString = formatDate(getCurrentWeekStartDate());
        }
        const targetWeekDate = new Date(`${targetWeekString}T00:00:00Z`);

        console.log('[GradingPage] Target week:', targetWeekString);

        // Get class details first
        const classData = await getClassDetails(classId, user.id);
        if (!classData) {
            console.error('[GradingPage] Class not found:', classId);
            notFound();
        }

        console.log('[GradingPage] Class data loaded:', {
            className: classData.name,
            teamId: classData.teamId,
            calendarYear: classData.calendarYear
        });

        // OPTIMIZED: Get all data in one go
        const {
            students: studentsData,
            gradeScales: gradeScalesData,
            plannedItems: plannedItemsData,
            assessments: assessmentsData,
            terms: termsData
        } = await getGradingData(classId, classData.teamId, classData.calendarYear, targetWeekDate);

        console.log('[GradingPage] Grading data loaded:', {
            studentsCount: studentsData.length,
            gradeScalesCount: gradeScalesData.length,
            plannedItemsCount: plannedItemsData.length,
            assessmentsCount: assessmentsData.length,
            termsCount: termsData.length
        });

        // Calculate allWeeks
        const allWeeks = termsData.flatMap(term => {
            const termStart = new Date(`${formatDate(term.startDate)}T00:00:00Z`);
            const termEnd = new Date(`${formatDate(term.endDate)}T00:00:00Z`);
            return (!isNaN(termStart.getTime()) && !isNaN(termEnd.getTime())) ? getWeeksBetween(termStart, termEnd) : [];
        }).sort((a, b) => a.getTime() - b.getTime());

        console.log('[GradingPage] All weeks calculated:', allWeeks.length);

        // Fallback logic (only if no specific week was requested and no items found)
        let finalTargetWeekDate = targetWeekDate;
        let finalPlannedItems = plannedItemsData;
        let finalAssessments = assessmentsData;

        if (!wasWeekRequested && plannedItemsData.length === 0 && allWeeks.length > 0) {
            console.log(`[GradingPage] No items for current week, finding fallback.`);
            const potentialFallbackWeeks = allWeeks.filter(w => w.getTime() <= targetWeekDate.getTime());
            const fallbackWeekDate = potentialFallbackWeeks.length > 0
                ? potentialFallbackWeeks[potentialFallbackWeeks.length - 1]
                : (allWeeks.length > 0 ? allWeeks[allWeeks.length - 1] : null);

            if (fallbackWeekDate && fallbackWeekDate.getTime() !== targetWeekDate.getTime()) {
                console.log(`[GradingPage] Falling back to week: ${fallbackWeekDate.toISOString()}`);
                finalTargetWeekDate = fallbackWeekDate;

                // Re-fetch for fallback week
                const fallbackData = await getGradingData(classId, classData.teamId, classData.calendarYear, finalTargetWeekDate);
                finalPlannedItems = fallbackData.plannedItems;
                finalAssessments = fallbackData.assessments;
                
                console.log('[GradingPage] Fallback data loaded:', {
                    plannedItemsCount: finalPlannedItems.length,
                    assessmentsCount: finalAssessments.length
                });
            }
        }

        console.log(`[GradingPage] Final Target Week: ${finalTargetWeekDate.toISOString()}`);
        console.log(`[GradingPage] Passing ${finalPlannedItems.length} planned items to client.`);
        console.log(`[GradingPage] Passing ${finalAssessments.length} assessments to client.`);

        return (
            <div className="flex flex-col h-full">
                <GradingTableClient
                    key={`${finalTargetWeekDate.toISOString()}-${classId}`}
                    classData={classData}
                    students={studentsData}
                    gradeScales={gradeScalesData}
                    plannedItems={finalPlannedItems}
                    initialAssessments={finalAssessments}
                    terms={termsData}
                    currentWeek={finalTargetWeekDate}
                    allWeeks={allWeeks}
                    currentClassId={classId}
                />
            </div>
        );

    } catch (error) {
        console.error('[GradingPage] Unexpected error:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        
        return (
            <div className="flex flex-col items-center justify-center h-96 space-y-4 p-8">
                <div className="text-center">
                    <h2 className="text-lg font-semibold text-red-600 mb-2">
                        Server Error
                    </h2>
                    <p className="text-gray-600 mb-4">
                        An error occurred while loading the grading page. Please try refreshing or contact support.
                    </p>
                    <details className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
                        <summary className="cursor-pointer">Error Details</summary>
                        <pre className="mt-2 whitespace-pre-wrap">
                            {error instanceof Error ? error.message : 'Unknown error occurred'}
                        </pre>
                    </details>
                </div>
            </div>
        );
    }
} 