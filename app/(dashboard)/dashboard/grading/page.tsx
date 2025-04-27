import { getTeacherClasses, getTeamClasses, getUserTeam } from '@/app/actions/get-classes'; // Import new actions
import { db } from '@/lib/db/drizzle';
import {
    classCurriculumPlan,
    classes,
    classTeachers,
    gradeScales,
    studentAssessments,
    studentEnrollments,
    terms,
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
    let currentDate = new Date(startDate);
    const dayOfWeek = currentDate.getDay();
    const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    currentDate = new Date(currentDate.setDate(diff));
    currentDate.setHours(0, 0, 0, 0);
    const finalEndDate = new Date(endDate);
    finalEndDate.setHours(0, 0, 0, 0);
    while (currentDate <= finalEndDate) {
      weeks.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 7);
    }
    return weeks;
}

// --- Data Fetching Functions ---

// Updated function to include authorization check
async function checkTeacherAuthorization(classId: number, userId: string): Promise<boolean> {
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
async function getClassDetails(classId: number, userId: string): Promise<(Class & { stage: Stage | null, teamId: number }) | null> {
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

type StudentWithEnrollment = StudentEnrollment & { student: Student };
async function getEnrolledStudents(classId: number): Promise<StudentWithEnrollment[]> {
    return db.query.studentEnrollments.findMany({
        where: and(
            eq(studentEnrollments.classId, classId),
            eq(studentEnrollments.status, 'active') // Only active students
        ),
        with: {
            student: true, // Include student details
        },
        orderBy: (enrollments, { asc }) => [asc(enrollments.studentId)], // Consistent order
    });
}

async function getGradeScales(teamId: number): Promise<GradeScale[]> {
    // TODO: Allow team-specific grade scales if needed
    return db.select().from(gradeScales).orderBy(gradeScales.numericValue);
}

// Revert getPlannedItemsForWeek to accept a Date object
type PlannedItemWithContentGroup = ClassCurriculumPlanItem & { contentGroup: { name: string } };
async function getPlannedItemsForWeek(classId: number, weekStartDate: Date): Promise<PlannedItemWithContentGroup[]> {
    // Drizzle ORM should handle matching the JS Date object to the database date column,
    // ignoring the time part if the column type is `date`.
    return db.query.classCurriculumPlan.findMany({
        where: and(
            eq(classCurriculumPlan.classId, classId),
            eq(classCurriculumPlan.weekStartDate, weekStartDate) // Use Date object
        ),
        with: {
            contentGroup: {
                columns: { name: true } // Only need the name
            }
        },
        orderBy: (planItems, { asc }) => [asc(planItems.contentGroupId)], // Consistent order
    });
}

async function getExistingAssessments(
    enrollmentIds: number[], 
    weekStartDate: Date
): Promise<StudentAssessment[]> {
    console.log(`[getExistingAssessments] Fetching for date: ${weekStartDate.toISOString()}`);
    if (enrollmentIds.length === 0) {
        return [];
    }
    try {
        const assessments = await db.select().from(studentAssessments)
                .where(and(
                    inArray(studentAssessments.studentEnrollmentId, enrollmentIds),
                    eq(studentAssessments.assessmentDate, weekStartDate)
                ));
        console.log(`[getExistingAssessments] Found ${assessments.length} assessments.`);
        return assessments;
    } catch (error) {
        console.error(`[getExistingAssessments] Error fetching assessments:`, error);
        return [];
    }
}

// Add function to get terms for the class year
async function getTermsForYear(teamId: number, calendarYear: number): Promise<Term[]> {
    return db.select().from(terms)
             .where(and(eq(terms.teamId, teamId), eq(terms.calendarYear, calendarYear)))
             .orderBy(terms.termNumber);
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
    const wasWeekRequested = !!weekParam; // Track if a specific week was requested

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

    let classId: number | null = null;
    if (rawClassId) {
        const parsedId = parseInt(rawClassId, 10);
        if (!isNaN(parsedId) && allTeamClasses.some(c => c.id === parsedId)) {
            classId = parsedId;
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

    // Determine the target week string and Date object
    let targetWeekString: string;
    if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
        targetWeekString = weekParam;
    } else {
        targetWeekString = formatDate(getCurrentWeekStartDate());
    }
    const targetWeekDate = new Date(`${targetWeekString}T00:00:00Z`);

    // Fetch essential data
    const classData = await getClassDetails(classId, user.id);
    if (!classData) {
        notFound();
    }
    const [studentsData, gradeScalesData, termsData] = await Promise.all([
        getEnrolledStudents(classId),
        getGradeScales(classData.teamId),
        getTermsForYear(classData.teamId, classData.calendarYear),
    ]);

    // Fetch initial planned items and assessments for the target week
    let plannedItemsData = await getPlannedItemsForWeek(classId, targetWeekDate);
    let assessmentsData = plannedItemsData.length > 0 
        ? await getExistingAssessments(studentsData.map(s => s.id), targetWeekDate)
        : [];

    // Calculate allWeeks
    const allWeeks = termsData.flatMap(term => {
        const termStart = new Date(`${formatDate(term.startDate)}T00:00:00Z`);
        const termEnd = new Date(`${formatDate(term.endDate)}T00:00:00Z`);
        return (!isNaN(termStart.getTime()) && !isNaN(termEnd.getTime())) ? getWeeksBetween(termStart, termEnd) : [];
    }).sort((a, b) => a.getTime() - b.getTime());

    // --- MODIFIED: Fallback Logic - Only apply if NO specific week was requested --- 
    let finalTargetWeekDate = targetWeekDate;

    if (!wasWeekRequested && plannedItemsData.length === 0 && allWeeks.length > 0) {
        console.log(`[GradingPage Server] Initial load has no items for current week ${targetWeekDate.toISOString()}. Finding fallback.`);
        const potentialFallbackWeeks = allWeeks.filter(w => w.getTime() <= targetWeekDate.getTime());
        let fallbackWeekDate: Date | null = potentialFallbackWeeks.length > 0 ? potentialFallbackWeeks[potentialFallbackWeeks.length - 1] : (allWeeks.length > 0 ? allWeeks[allWeeks.length - 1] : null);

        if (fallbackWeekDate && fallbackWeekDate.getTime() !== targetWeekDate.getTime()) {
            console.log(`[GradingPage Server] Falling back to week: ${fallbackWeekDate.toISOString()}`);
            finalTargetWeekDate = fallbackWeekDate;
            // Re-fetch planned items and assessments for the fallback week
            plannedItemsData = await getPlannedItemsForWeek(classId, finalTargetWeekDate);
            assessmentsData = plannedItemsData.length > 0 
                ? await getExistingAssessments(studentsData.map(s => s.id), finalTargetWeekDate)
                : [];
        }
    } 
    // If a week *was* requested, we stick with the initially fetched data (even if empty)
    // --- End Modified Fallback Logic ---

    // --- Logging --- 
    console.log(`[GradingPage Server] Final Target Week: ${finalTargetWeekDate.toISOString()}`);
    console.log(`[GradingPage Server] Passing ${plannedItemsData.length} planned items to client.`);
    console.log(`[GradingPage Server] Passing ${assessmentsData.length} assessments to client.`);

    return (
        <div className="flex flex-col h-full">
            <GradingTableClient
                key={`${finalTargetWeekDate.toISOString()}-${classId}`}
                classData={classData}
                students={studentsData}
                gradeScales={gradeScalesData}
                plannedItems={plannedItemsData}
                initialAssessments={assessmentsData} // Use assessmentsData variable
                terms={termsData}
                currentWeek={finalTargetWeekDate}
                allWeeks={allWeeks}
                currentClassId={classId}
            />
        </div>
    );
} 