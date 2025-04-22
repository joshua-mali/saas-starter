import { db } from '@/lib/db/drizzle';
import {
    classes,
    classTeachers,
    contentGroups,
    contentPoints,
    focusAreas,
    focusGroups,
    gradeScales,
    outcomes,
    studentAssessments,
    studentEnrollments,
    subjects,
    type Class,
    type GradeScale,
    type Stage,
    type Student,
    type StudentAssessment,
    type StudentEnrollment
} from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import StudentOverviewClient from './client'; // Import the client component

// TODO: Define Authorization check function (or import if shared)
// async function checkTeacherAuthorization(classId: number, userId: string): Promise<boolean> { ... }

// --- Authorization Function (Ideally move to shared utils) ---
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

// --- Data Fetching Functions ---

async function getStudentEnrollment(classId: number, studentId: number): Promise<(StudentEnrollment & { student: Student }) | null | undefined> {
    return db.query.studentEnrollments.findFirst({
        where: and(
            eq(studentEnrollments.classId, classId),
            eq(studentEnrollments.studentId, studentId)
        ),
        with: {
            student: true // Include student details
        }
    });
}

async function getClassDetails(classId: number): Promise<(Class & { stage: Stage | null }) | null | undefined> {
    return db.query.classes.findFirst({
        where: eq(classes.id, classId),
        with: {
            stage: true // Include stage details
        }
    });
}

async function getFullCurriculumHierarchy(stageId: number) {
    // Fetch the complete hierarchy for the given stage
    // This might be inefficient; consider optimizing if needed
    return db.select({
        subjectId: subjects.id,
        subjectName: subjects.name,
        outcomeId: outcomes.id,
        outcomeName: outcomes.name,
        focusAreaId: focusAreas.id,
        focusAreaName: focusAreas.name,
        focusGroupId: focusGroups.id,
        focusGroupName: focusGroups.name,
        contentGroupId: contentGroups.id,
        contentGroupName: contentGroups.name,
        contentPointId: contentPoints.id,
        contentPointName: contentPoints.name,
        contentPointDescription: contentPoints.description,
    })
    .from(subjects)
    .leftJoin(outcomes, eq(outcomes.subjectId, subjects.id))
    .leftJoin(focusAreas, eq(focusAreas.outcomeId, outcomes.id))
    .leftJoin(focusGroups, eq(focusGroups.focusAreaId, focusAreas.id))
    .leftJoin(contentGroups, eq(contentGroups.focusGroupId, focusGroups.id))
    .leftJoin(contentPoints, eq(contentPoints.contentGroupId, contentGroups.id))
    .where(eq(focusAreas.stageId, stageId))
    // Order meaningfully for easier processing later
    .orderBy(subjects.name, outcomes.name, focusAreas.name, focusGroups.name, contentGroups.name, contentPoints.orderIndex, contentPoints.name);
}

type FullHierarchyItem = Awaited<ReturnType<typeof getFullCurriculumHierarchy>>[0];

async function getStudentAssessmentsForEnrollment(enrollmentId: number): Promise<StudentAssessment[]> {
    return db.select()
             .from(studentAssessments)
             .where(eq(studentAssessments.studentEnrollmentId, enrollmentId));
}

async function getGradeScalesForTeam(teamId: number): Promise<GradeScale[]> {
    // Assuming grade scales might eventually be team-specific, 
    // but for now fetching all. Replace with team-specific query if needed.
    // TODO: Filter by teamId if grade_scales table gets a team_id column
    return db.select().from(gradeScales).orderBy(gradeScales.numericValue);
}

// --- Data Processing Helper --- 

type ProcessedNode = {
    id: number;
    name: string;
    type: 'subject' | 'outcome' | 'focusArea' | 'focusGroup' | 'contentGroup' | 'contentPoint';
    averageGrade?: number | null; // Average of descendants (null if no grades)
    gradeScaleId?: number | null; // Direct grade if applicable (contentGroup/Point)
    gradeName?: string | null;
    children: Record<number, ProcessedNode>;
    description?: string | null; // For Content Points
};

type AssessmentMap = Map<string, number>; // key: "group-<id>" or "point-<id>", value: gradeScaleId
type GradeScaleMap = Map<number, { name: string; numericValue: number }>; // key: gradeScaleId

function processStudentGrades(
    hierarchyData: FullHierarchyItem[], 
    assessmentsData: StudentAssessment[], 
    gradeScalesData: GradeScale[]
): Record<number, ProcessedNode> { // Returns map of Subjects
    
    const structuredHierarchy: Record<number, ProcessedNode> = {}; // Top level is subjects

    // 1. Create Assessment Lookup Map
    const assessmentMap: AssessmentMap = new Map();
    for (const assessment of assessmentsData) {
        if (assessment.contentPointId) {
            assessmentMap.set(`point-${assessment.contentPointId}`, assessment.gradeScaleId);
        } else {
            // Assume assessment is for the content group if pointId is null
            assessmentMap.set(`group-${assessment.contentGroupId}`, assessment.gradeScaleId);
        }
    }

    // 2. Create Grade Scale Lookup Map
    const gradeScaleMap: GradeScaleMap = new Map();
    for (const scale of gradeScalesData) {
        gradeScaleMap.set(scale.id, { name: scale.name, numericValue: scale.numericValue });
    }

    // 3. Build Nested Hierarchy Structure
    for (const item of hierarchyData) {
        // Ensure subject exists
        if (!structuredHierarchy[item.subjectId]) {
            structuredHierarchy[item.subjectId] = { id: item.subjectId, name: item.subjectName ?? '', type: 'subject', children: {} };
        }
        const subjectNode = structuredHierarchy[item.subjectId];

        // Ensure outcome exists
        if (item.outcomeId && !subjectNode.children[item.outcomeId]) {
            subjectNode.children[item.outcomeId] = { id: item.outcomeId, name: item.outcomeName ?? '', type: 'outcome', children: {} };
        }
        const outcomeNode = item.outcomeId ? subjectNode.children[item.outcomeId] : null;

        // Ensure focusArea exists
        if (outcomeNode && item.focusAreaId && !outcomeNode.children[item.focusAreaId]) {
            outcomeNode.children[item.focusAreaId] = { id: item.focusAreaId, name: item.focusAreaName ?? '', type: 'focusArea', children: {} };
        }
        const focusAreaNode = (outcomeNode && item.focusAreaId) ? outcomeNode.children[item.focusAreaId] : null;

        // Ensure focusGroup exists
        if (focusAreaNode && item.focusGroupId && !focusAreaNode.children[item.focusGroupId]) {
            focusAreaNode.children[item.focusGroupId] = { id: item.focusGroupId, name: item.focusGroupName ?? '', type: 'focusGroup', children: {} };
        }
        const focusGroupNode = (focusAreaNode && item.focusGroupId) ? focusAreaNode.children[item.focusGroupId] : null;

        // Ensure contentGroup exists
        if (focusGroupNode && item.contentGroupId && !focusGroupNode.children[item.contentGroupId]) {
            const gradeScaleId = assessmentMap.get(`group-${item.contentGroupId}`) ?? null;
            const gradeInfo = gradeScaleId ? gradeScaleMap.get(gradeScaleId) : null;
            focusGroupNode.children[item.contentGroupId] = { 
                id: item.contentGroupId, 
                name: item.contentGroupName ?? '', 
                type: 'contentGroup', 
                children: {},
                gradeScaleId: gradeScaleId,
                gradeName: gradeInfo?.name ?? null,
                averageGrade: gradeInfo?.numericValue ?? null // For a group, direct grade acts as its average
            };
        }
        const contentGroupNode = (focusGroupNode && item.contentGroupId) ? focusGroupNode.children[item.contentGroupId] : null;

        // Add contentPoint
        if (contentGroupNode && item.contentPointId && !contentGroupNode.children[item.contentPointId]) {
            const gradeScaleId = assessmentMap.get(`point-${item.contentPointId}`) ?? null;
            const gradeInfo = gradeScaleId ? gradeScaleMap.get(gradeScaleId) : null;
            contentGroupNode.children[item.contentPointId] = { 
                id: item.contentPointId, 
                name: item.contentPointName ?? '', 
                type: 'contentPoint', 
                description: item.contentPointDescription,
                children: {}, // Content points have no children in this structure
                gradeScaleId: gradeScaleId,
                gradeName: gradeInfo?.name ?? null,
                averageGrade: gradeInfo?.numericValue ?? null // For a point, direct grade acts as its average
             };
        }
    }

    // 4. Calculate Averages Recursively (Bottom-up)
    function calculateNodeAverage(node: ProcessedNode): number | null {
        if (node.type === 'contentPoint' || node.type === 'contentGroup') {
            // Base case: Average is the direct numeric grade if it exists
            return node.averageGrade ?? null; // Already set during creation
        }

        let totalNumericGrade = 0;
        let gradedChildrenCount = 0;
        let hasAnyGrade = false;

        for (const childId in node.children) {
            const childAverage = calculateNodeAverage(node.children[childId]);
            if (childAverage !== null) {
                totalNumericGrade += childAverage;
                gradedChildrenCount++;
                hasAnyGrade = true;
            }
        }

        // Store the calculated average on the node
        node.averageGrade = hasAnyGrade ? (totalNumericGrade / gradedChildrenCount) : null;
        return node.averageGrade;
    }

    // Trigger calculation for each subject
    for (const subjectId in structuredHierarchy) {
        calculateNodeAverage(structuredHierarchy[subjectId]);
    }

    return structuredHierarchy;
}

interface StudentOverviewPageProps {
    params: {
        classId: string;
        studentId: string;
    };
}

export default async function StudentOverviewPage({
    params: { classId: rawClassId, studentId: rawStudentId }
}: StudentOverviewPageProps) {

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/sign-in');
    }

    const classId = parseInt(rawClassId, 10);
    const studentId = parseInt(rawStudentId, 10);

    if (isNaN(classId) || isNaN(studentId)) {
        notFound(); // Invalid parameters
    }

    // --- Authorization Check ---
    const isAuthorized = await checkTeacherAuthorization(classId, user.id);
    if (!isAuthorized) {
        notFound(); // User is not a teacher for this class
    }

    // --- Fetch Core Data Concurrently ---
    const [enrollment, classData] = await Promise.all([
        getStudentEnrollment(classId, studentId),
        getClassDetails(classId),
    ]);

    if (!enrollment || !classData || !classData.stageId) {
        // Student not enrolled in this class, class doesn't exist, or class has no stage
        console.error("Enrollment or ClassData missing or incomplete", { enrollment, classData });
        notFound();
    }

    // --- Fetch Dependent Data Concurrently ---
    const [hierarchyData, assessmentsData, gradeScalesData] = await Promise.all([
        getFullCurriculumHierarchy(classData.stageId),
        getStudentAssessmentsForEnrollment(enrollment.id),
        getGradeScalesForTeam(classData.teamId), // Assumes grade scales are global for now
    ]);
    
    console.log(`Fetched ${hierarchyData.length} hierarchy items.`);
    console.log(`Fetched ${assessmentsData.length} assessments.`);
    console.log(`Fetched ${gradeScalesData.length} grade scales.`);

    // --- Process Data ---
    const processedGrades = processStudentGrades(hierarchyData, assessmentsData, gradeScalesData);

    // --- Pass to Client Component --- 
    return (
        <div className="p-4">
            <h1 className="text-xl font-semibold mb-1">
                Student Overview: {enrollment.student.firstName} {enrollment.student.lastName}
            </h1>
            <p className="text-sm text-muted-foreground mb-4">
                Class: {classData.name} (Stage {classData.stage?.name})
            </p>
            <hr className="mb-4"/>
            <StudentOverviewClient 
                student={enrollment.student} 
                classData={classData} 
                structuredGrades={processedGrades} 
             />
        </div>
    );
}