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

// --- Page Component Props Interface (Remove Promise wrappers) ---

interface GradingPageProps {
    params: {
        classId: string; // From dynamic route
    };
    searchParams: {
        week?: string; // Optional week start date (YYYY-MM-DD)
    }
}

// --- Page Component (Use standard destructuring) ---

export default async function GradingPage(props: GradingPageProps) {
    const { params: { classId: rawClassId }, searchParams: { week } } = props;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/sign-in');
    }

    const classId = parseInt(rawClassId, 10);
    if (isNaN(classId)) {
        notFound();
    }

    // --- Authorization Check ---
    const isAuthorized = await checkTeacherAuthorization(classId, user.id);
    if (!isAuthorized) {
        notFound(); // User is not a teacher for this class
    }

    // Determine the week string and Date object (parsed as UTC)
    let targetWeekString: string;
    if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) {
        targetWeekString = week;
    } else {
        targetWeekString = formatDate(getCurrentWeekStartDate()); // YYYY-MM-DD
    }
    const targetWeekDate = new Date(`${targetWeekString}T00:00:00Z`); // UTC Midnight Date object

    // --- Fetch Data Concurrently ---
    const classData = await getClassDetails(classId, user.id);
    if (!classData) {
        notFound();
    }

    // Pass the Date object to getPlannedItemsForWeek
    const [studentsData, gradeScalesData, plannedItemsData, termsData] = await Promise.all([
        getEnrolledStudents(classId),
        getGradeScales(classData.teamId),
        getPlannedItemsForWeek(classId, targetWeekDate), // <-- Pass Date object
        getTermsForYear(classData.teamId, classData.calendarYear),
    ]);

    // --- Server-side Logging --- 
    console.log(`[GradingPage Server] Fetching for week date obj: ${targetWeekDate.toISOString()}`);
    console.log(`[GradingPage Server] Fetched ${plannedItemsData.length} planned items.`);
    // --- End Logging --- 

    // Calculate allWeeks using UTC-based dates
    const allWeeks = termsData.flatMap(term => {
        const termStart = new Date(`${formatDate(term.startDate)}T00:00:00Z`);
        const termEnd = new Date(`${formatDate(term.endDate)}T00:00:00Z`);
        if (!isNaN(termStart.getTime()) && !isNaN(termEnd.getTime())) {
            return getWeeksBetween(termStart, termEnd); // Ensure getWeeksBetween also works with UTC dates
        }
        return [];
    }).sort((a, b) => a.getTime() - b.getTime());

    // --- Week Fallback Logic ---
    let finalTargetWeekDate = targetWeekDate;
    let finalPlannedItemsData = plannedItemsData;
    let finalAssessmentsData: StudentAssessment[] = []; // Initialize assessment data array

    if (finalPlannedItemsData.length === 0 && allWeeks.length > 0) {
        console.log(`[GradingPage Server] No planned items for ${targetWeekDate.toISOString()}. Finding fallback week.`);
        // Find the latest week in allWeeks <= original targetWeekDate
        const potentialFallbackWeeks = allWeeks.filter(w => w.getTime() <= targetWeekDate.getTime());
        let fallbackWeekDate: Date | null = null;

        if (potentialFallbackWeeks.length > 0) {
            fallbackWeekDate = potentialFallbackWeeks[potentialFallbackWeeks.length - 1];
        } else {
            // If no week is before or equal, use the very last week available
            fallbackWeekDate = allWeeks[allWeeks.length - 1];
        }

        if (fallbackWeekDate && fallbackWeekDate.getTime() !== targetWeekDate.getTime()) {
            console.log(`[GradingPage Server] Falling back to week: ${fallbackWeekDate.toISOString()}`);
            finalTargetWeekDate = fallbackWeekDate;
            // Re-fetch planned items and assessments for the fallback week
            finalPlannedItemsData = await getPlannedItemsForWeek(classId, finalTargetWeekDate);
            // Fetch assessments only if there are planned items for the fallback week
            if (finalPlannedItemsData.length > 0) {
                const studentEnrollmentIds = studentsData.map(s => s.id);
                finalAssessmentsData = await getExistingAssessments(studentEnrollmentIds, finalTargetWeekDate);
            } else {
                console.log(`[GradingPage Server] Fallback week ${fallbackWeekDate.toISOString()} also has no planned items.`);
                finalAssessmentsData = []; // Ensure it's empty if fallback also has no items
            }
            console.log(`[GradingPage Server] Fetched ${finalPlannedItemsData.length} planned items for fallback week.`);
        } else {
            console.log(`[GradingPage Server] Fallback week is same as target or no fallback possible. Using original empty planned items.`);
            // If fallback is the same or no fallback possible, assessments remain empty
            finalAssessmentsData = []; 
        }
    } else {
        // If initial fetch had items, fetch assessments for the initial target week
        const studentEnrollmentIds = studentsData.map(s => s.id);
        finalAssessmentsData = await getExistingAssessments(studentEnrollmentIds, finalTargetWeekDate);
        console.log(`[GradingPage Server] Assessments data fetched after getExistingAssessments: ${finalAssessmentsData.length} items`);
    }

    // --- Log data before passing to client ---
    console.log(`[GradingPage Server] Passing ${finalPlannedItemsData.length} planned items to client:`, 
        JSON.stringify(finalPlannedItemsData.map(p => ({ id: p.id, name: p.contentGroup.name }))) // Log IDs and names
    );
    console.log(`[GradingPage Server] Passing ${finalAssessmentsData.length} assessments to client:`, 
        JSON.stringify(finalAssessmentsData.map(a => ({ // Log key fields
            id: a.id, 
            enrollmentId: a.studentEnrollmentId, 
            planId: a.classCurriculumPlanId, 
            date: a.assessmentDate 
        })))
    );
    // --- End Logging ---

    return (
        <div className="flex flex-col h-full">
            <GradingTableClient
                key={finalTargetWeekDate.toISOString()}
                classData={classData}
                students={studentsData}
                gradeScales={gradeScalesData}
                plannedItems={finalPlannedItemsData}
                initialAssessments={finalAssessmentsData}
                terms={termsData}
                currentWeek={finalTargetWeekDate}
                allWeeks={allWeeks}
            />
        </div>
    );
} 