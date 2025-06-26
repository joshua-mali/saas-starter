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
        
        // Get grade scales
        db.select().from(gradeScalesTable).orderBy(gradeScalesTable.numericValue),
        
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
    const searchParams = await searchParamsPromise;
    const rawClassId = Array.isArray(searchParams.classId) ? searchParams.classId[0] : searchParams.classId;
    const weekParam = Array.isArray(searchParams.week) ? searchParams.week[0] : searchParams.week;
    const wasWeekRequested = !!weekParam;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/sign-in');
    }

    const userTeamId = await getUserTeam(user.id);
    if (!userTeamId) {
        console.error("User is not part of any team.");
        return <div>Error: You are not part of a team.</div>;
    }

    const [userTaughtClasses, allTeamClasses] = await Promise.all([
        getTeacherClasses(user.id),
        getTeamClasses(userTeamId)
    ]);

    let classId: string | null = null;
    if (rawClassId) {
        if (allTeamClasses.some(c => c.id === rawClassId)) {
            classId = rawClassId;
        } else {
             console.warn(`Invalid or unauthorized classId requested: ${rawClassId}.`);
        }
    }
    if (classId === null && userTaughtClasses.length > 0) {
        classId = userTaughtClasses[0].id;
    }
    if (classId === null) {
        return (
            <div className="p-4">
                Please select a class from the dropdown above to view grading.
            </div>
        );
    }

    // Determine the target week
    let targetWeekString: string;
    if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
        targetWeekString = weekParam;
    } else {
        targetWeekString = formatDate(getCurrentWeekStartDate());
    }
    const targetWeekDate = new Date(`${targetWeekString}T00:00:00Z`);

    // Get class details first
    const classData = await getClassDetails(classId, user.id);
    if (!classData) {
        notFound();
    }

    // OPTIMIZED: Get all data in one go
    const {
        students: studentsData,
        gradeScales: gradeScalesData,
        plannedItems: plannedItemsData,
        assessments: assessmentsData,
        terms: termsData
    } = await getGradingData(classId, classData.teamId, classData.calendarYear, targetWeekDate);

    // Calculate allWeeks
    const allWeeks = termsData.flatMap(term => {
        const termStart = new Date(`${formatDate(term.startDate)}T00:00:00Z`);
        const termEnd = new Date(`${formatDate(term.endDate)}T00:00:00Z`);
        return (!isNaN(termStart.getTime()) && !isNaN(termEnd.getTime())) ? getWeeksBetween(termStart, termEnd) : [];
    }).sort((a, b) => a.getTime() - b.getTime());

    // Fallback logic (only if no specific week was requested and no items found)
    let finalTargetWeekDate = targetWeekDate;
    let finalPlannedItems = plannedItemsData;
    let finalAssessments = assessmentsData;

    if (!wasWeekRequested && plannedItemsData.length === 0 && allWeeks.length > 0) {
        console.log(`[GradingPage Server] No items for current week, finding fallback.`);
        const potentialFallbackWeeks = allWeeks.filter(w => w.getTime() <= targetWeekDate.getTime());
        const fallbackWeekDate = potentialFallbackWeeks.length > 0 
            ? potentialFallbackWeeks[potentialFallbackWeeks.length - 1] 
            : (allWeeks.length > 0 ? allWeeks[allWeeks.length - 1] : null);

        if (fallbackWeekDate && fallbackWeekDate.getTime() !== targetWeekDate.getTime()) {
            console.log(`[GradingPage Server] Falling back to week: ${fallbackWeekDate.toISOString()}`);
            finalTargetWeekDate = fallbackWeekDate;
            
            // Re-fetch for fallback week
            const fallbackData = await getGradingData(classId, classData.teamId, classData.calendarYear, finalTargetWeekDate);
            finalPlannedItems = fallbackData.plannedItems;
            finalAssessments = fallbackData.assessments;
        }
    }

    console.log(`[GradingPage Server] Final Target Week: ${finalTargetWeekDate.toISOString()}`);
    console.log(`[GradingPage Server] Passing ${finalPlannedItems.length} planned items to client.`);
    console.log(`[GradingPage Server] Passing ${finalAssessments.length} assessments to client.`);

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
} 