import { db } from '@/lib/db/drizzle';
import {
    classCurriculumPlan,
    classes,
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
const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD format
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

// TODO: Refactor with Planning page fetch if identical (or create shared util)
async function getClassDetails(classId: number, userId: string): Promise<(Class & { stage: Stage | null, teamId: number }) | null> {
    const result = await db.query.classes.findFirst({
        where: and(
            eq(classes.id, classId),
            // TODO: Add proper authorization check (e.g., user is a teacher for this class)
        ),
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

type PlannedItemWithContentGroup = ClassCurriculumPlanItem & { contentGroup: { name: string } };
async function getPlannedItemsForWeek(classId: number, weekStartDate: Date): Promise<PlannedItemWithContentGroup[]> {
    return db.query.classCurriculumPlan.findMany({
        where: and(
            eq(classCurriculumPlan.classId, classId),
            eq(classCurriculumPlan.weekStartDate, weekStartDate)
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
    planItemIds: number[]
): Promise<StudentAssessment[]> {
    if (enrollmentIds.length === 0 || planItemIds.length === 0) {
        return [];
    }
    return db.select().from(studentAssessments)
             .where(and(
                 inArray(studentAssessments.studentEnrollmentId, enrollmentIds),
                 inArray(studentAssessments.classCurriculumPlanId, planItemIds)
             ));
}

// Add function to get terms for the class year
async function getTermsForYear(teamId: number, calendarYear: number): Promise<Term[]> {
    return db.select().from(terms)
             .where(and(eq(terms.teamId, teamId), eq(terms.calendarYear, calendarYear)))
             .orderBy(terms.termNumber);
}

// --- Page Component Props Interface ---

interface GradingPageProps {
    params: {
        classId: string; // From dynamic route
    };
    searchParams: {
        week?: string; // Optional week start date (YYYY-MM-DD)
    }
}

// --- Page Component ---

export default async function GradingPage({ params, searchParams }: GradingPageProps) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/sign-in');
    }

    // Destructure params and searchParams
    const { classId: rawClassId } = params;
    const { week } = searchParams;

    const classId = parseInt(rawClassId, 10);
    if (isNaN(classId)) {
        notFound(); // Invalid classId parameter
    }

    // Determine the week to display
    let targetWeekStartDate: Date;
    if (week) { // Use the destructured week variable
        targetWeekStartDate = new Date(week);
        targetWeekStartDate.setHours(0, 0, 0, 0);
        if (isNaN(targetWeekStartDate.getTime())) {
            targetWeekStartDate = getCurrentWeekStartDate(); // Fallback if date is invalid
        }
    } else {
        targetWeekStartDate = getCurrentWeekStartDate();
    }

    // --- Fetch Data Concurrently ---
    const classData = await getClassDetails(classId, user.id);
    if (!classData) {
        notFound(); // Class not found or user not authorized
    }

    // Add termsData to Promise.all
    const [studentsData, gradeScalesData, plannedItemsData, termsData] = await Promise.all([
        getEnrolledStudents(classId),
        getGradeScales(classData.teamId),
        getPlannedItemsForWeek(classId, targetWeekStartDate),
        getTermsForYear(classData.teamId, classData.calendarYear), // Fetch terms
    ]);

    // Get IDs for fetching existing assessments
    const studentEnrollmentIds = studentsData.map(s => s.id);
    const plannedItemIds = plannedItemsData.map(p => p.id);
    
    const assessmentsData = await getExistingAssessments(studentEnrollmentIds, plannedItemIds);

    // Calculate all weeks for navigation dropdown
    const allWeeks = termsData.flatMap(term => {
        const start = new Date(term.startDate);
        const end = new Date(term.endDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            return getWeeksBetween(start, end);
        }
        return [];
    }).sort((a, b) => a.getTime() - b.getTime());

    return (
        <div className="flex flex-col h-full">
            {/* Grading Table Client Component - Renders controls and table */}
            <GradingTableClient 
                classData={classData} 
                students={studentsData}
                gradeScales={gradeScalesData}
                plannedItems={plannedItemsData}
                initialAssessments={assessmentsData}
                terms={termsData} // Still needed if client uses term boundaries
                currentWeek={targetWeekStartDate}
                allWeeks={allWeeks} // Pass pre-calculated weeks
            />
        </div>
    );
} 