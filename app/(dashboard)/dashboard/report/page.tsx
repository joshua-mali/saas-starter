export const dynamic = 'force-dynamic'; // Ensure the page re-renders on every request

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
import ClassReportClient from './client'; // Import the new client component

// --- Authorization Function (Reuse or adapt from existing page) ---
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

// --- Data Fetching Functions (Reuse/adapt from existing page) ---

async function getClassDetails(classId: string): Promise<(Class & { stage: Stage | null }) | null | undefined> {
    return db.query.classes.findFirst({
        where: eq(classes.id, classId),
        with: {
            stage: true // Include stage details
        }
    });
}

async function getAllStudentEnrollmentsForClass(classId: string): Promise<(StudentEnrollment & { student: Student })[]> {
    return db.query.studentEnrollments.findMany({
        where: eq(studentEnrollments.classId, classId),
        with: {
            student: true // Include student details
        }
    });
}

async function getFullCurriculumHierarchy(stageId: number) {
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
    .orderBy(subjects.name, outcomes.name, focusAreas.name, focusGroups.name, contentGroups.name, contentPoints.orderIndex, contentPoints.name);
}

type FullHierarchyItem = Awaited<ReturnType<typeof getFullCurriculumHierarchy>>[0];

async function getStudentAssessmentsForEnrollment(enrollmentId: string): Promise<StudentAssessment[]> {
    return db.select()
             .from(studentAssessments)
             .where(eq(studentAssessments.studentEnrollmentId, enrollmentId));
}

async function getGradeScalesForTeam(teamId: number): Promise<GradeScale[]> {
    return db.select().from(gradeScales).orderBy(gradeScales.numericValue); // TODO: Filter by teamId if needed
}

// --- Data Processing Helper (Adapted for Report) --- 

type ProcessedNode = {
    id: number;
    name: string;
    type: 'subject' | 'outcome' | 'focusArea' | 'focusGroup' | 'contentGroup' | 'contentPoint';
    averageGrade?: number | null; // Average of descendants (null if no grades)
    gradeScaleId?: number | null; // Direct grade if applicable
    gradeName?: string | null;
    numericValue?: number | null; // Numeric value of direct grade
    children: Record<number, ProcessedNode>;
    description?: string | null; 
};

type ProcessedStudentReportData = {
    studentId: string;
    studentFirstName: string;
    studentLastName: string;
    overallAverage: number | null;
    outcomeAverages: Map<number, { name: string; average: number | null }>;
    topContentGroups: Array<{ id: number; name: string; gradeName: string | null }>;
    bottomContentGroups: Array<{ id: number; name: string; gradeName: string | null }>;
};

type AssessmentMap = Map<string, number>; // key: "group-<id>" or "point-<id>", value: gradeScaleId
type GradeScaleMap = Map<number, { name: string; numericValue: number }>; // key: gradeScaleId

function processStudentGradesForReport(
    student: Student,
    hierarchyData: FullHierarchyItem[], 
    assessmentsData: StudentAssessment[], 
    gradeScalesData: GradeScale[]
): ProcessedStudentReportData {
    
    const structuredHierarchy: Record<number, ProcessedNode> = {}; // Top level is subjects
    const allContentGroups: ProcessedNode[] = [];

    // 1. Create Assessment Lookup Map
    const assessmentMap: AssessmentMap = new Map();
    for (const assessment of assessmentsData) {
        if (assessment.contentPointId) {
            assessmentMap.set(`point-${assessment.contentPointId}`, assessment.gradeScaleId);
        } else {
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
            const newNode: ProcessedNode = {
                id: item.contentGroupId,
                name: item.contentGroupName ?? '',
                type: 'contentGroup',
                children: {},
                gradeScaleId: gradeScaleId,
                gradeName: gradeInfo?.name ?? null,
                numericValue: gradeInfo?.numericValue ?? null,
                // Average will be calculated later based on children
            };
            focusGroupNode.children[item.contentGroupId] = newNode;
            allContentGroups.push(newNode); // Collect for sorting later
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
                children: {}, // Content points are leaves
                gradeScaleId: gradeScaleId,
                gradeName: gradeInfo?.name ?? null,
                numericValue: gradeInfo?.numericValue ?? null, // Store numeric value
                averageGrade: gradeInfo?.numericValue ?? null // For a point, direct grade IS its average
             };
        }
    }

    // 4. Calculate Averages Recursively (Bottom-up)
    function calculateNodeAverage(node: ProcessedNode): number | null {
        if (node.type === 'contentPoint') {
            // Base case for content points: use their direct grade's numeric value if available
            // Use numericValue which holds the direct grade value set during hierarchy build
            const pointAvg = node.numericValue ?? null; 
            // Also ensure averageGrade reflects this, although numericValue is key for sorting/calcs
            node.averageGrade = pointAvg; 
            console.log(`  [AvgCalc] Node: ${node.name} (${node.type}), Base Avg: ${pointAvg}, Numeric: ${node.numericValue}`);
            return pointAvg;
        }

        let totalNumericGrade = 0;
        let gradedChildrenCount = 0;
        let hasAnyGradeInChildren = false;

        // Calculate average based on children first
        for (const childId in node.children) {
            const childNode = node.children[childId];
            // Only average direct children that are relevant (points/groups for group avg, etc.)
            // Or just recurse to calculate averages down the tree
            const childAverage = calculateNodeAverage(childNode);
            
            // Include child average in parent calculation IF the child has a valid average
            // AND the parent type is meant to average children (Group, Area, Outcome, Subject)
            // This prevents double-counting if we change hierarchy logic later
            if (childAverage !== null && (
                node.type === 'contentGroup' || 
                node.type === 'focusGroup' || 
                node.type === 'focusArea' || 
                node.type === 'outcome' || 
                node.type === 'subject'
            )) {
                totalNumericGrade += childAverage;
                gradedChildrenCount++;
                hasAnyGradeInChildren = true;
            }
        }

        const childrenAverage = hasAnyGradeInChildren ? (totalNumericGrade / gradedChildrenCount) : null;

        // Now, determine the final averageGrade and numericValue for THIS node
        if (node.type === 'contentGroup') {
            // Check if the group has a DIRECT grade (numericValue was set during build if assessment existed)
            if (node.numericValue !== null && node.gradeScaleId !== null) { 
                 // If direct grade exists, it takes precedence for this node's average
                 node.averageGrade = node.numericValue;
                 // Keep node.numericValue as is (it's the direct grade value)
                 console.log(`  [AvgCalc] Node: ${node.name} (${node.type}), Using DIRECT Avg: ${node.averageGrade}, Numeric: ${node.numericValue}`);
            } else {
                 // No direct grade, so use the average of its children (which would be Content Points)
                 node.averageGrade = childrenAverage;
                 node.numericValue = childrenAverage; // Update numericValue for sorting based on children avg
                 console.log(`  [AvgCalc] Node: ${node.name} (${node.type}), Using CHILDREN Avg: ${node.averageGrade}, Numeric: ${node.numericValue}`);
            }
        } else {
             // For higher levels (FocusGroup, Area, Outcome, Subject), average their children's averages
             const avg = (childrenAverage ?? null) as (number | null); // Cast to specific type
             node.averageGrade = avg;
             node.numericValue = avg; 
             console.log(`  [AvgCalc] Node: ${node.name} (${node.type}), Calculated Avg: ${node.averageGrade}, Numeric: ${node.numericValue}`);
        }

        // Ensure the final return is explicitly number or null
        const finalAvg = node.averageGrade;
        return typeof finalAvg === 'number' ? finalAvg : null;
    }

    // Trigger calculation for each subject
    let overallTotal = 0;
    let overallCount = 0;
    for (const subjectId in structuredHierarchy) {
        const subjectAvg = calculateNodeAverage(structuredHierarchy[subjectId]);
        if (subjectAvg !== null) {
            overallTotal += subjectAvg;
            overallCount++;
        }
    }
    const overallAverage = overallCount > 0 ? (overallTotal / overallCount) : null;

    console.log(`Calculated Overall Average for student ${student.id}: ${overallAverage}`); // Log overall average

    // 5. Extract Outcome Averages
    const outcomeAverages = new Map<number, { name: string; average: number | null }>();
    for (const subjectId in structuredHierarchy) {
        const subjectNode = structuredHierarchy[subjectId];
        for (const outcomeId in subjectNode.children) {
            const outcomeNode = subjectNode.children[outcomeId];
            if (!outcomeAverages.has(outcomeNode.id)) { // Avoid duplicates if hierarchy is weird
                 outcomeAverages.set(outcomeNode.id, { 
                     name: outcomeNode.name, 
                     average: outcomeNode.averageGrade ?? null 
                 });
            }
        }
    }

    console.log(`Extracted Outcome Averages for student ${student.id}:`, outcomeAverages); // Log outcome map

    // 6. Determine Top/Bottom Content Groups
    const gradedContentGroups = allContentGroups
        .filter(cg => cg.numericValue !== null)
        .sort((a, b) => (b.numericValue!) - (a.numericValue!)); // Sort descending by numeric value
    
    // --- ADDED LOGGING --- 
    console.log(`Graded Content Groups for student ${student.id} (Count: ${gradedContentGroups.length}):`, gradedContentGroups.map(cg => ({ name: cg.name, avg: cg.averageGrade, num: cg.numericValue, grade: cg.gradeName })));
    // --- END ADDED LOGGING ---

    const topContentGroups = gradedContentGroups.slice(0, 3).map(cg => ({ 
        id: cg.id, 
        name: cg.name, 
        gradeName: cg.gradeName ?? null // Ensure null instead of undefined
    }));
    const bottomContentGroups = gradedContentGroups.slice(-3).reverse().map(cg => ({ // reverse to show lowest first
        id: cg.id, 
        name: cg.name, 
        gradeName: cg.gradeName ?? null // Ensure null instead of undefined
    })); 

    // 7. Assemble Final Report Data
    return {
        studentId: student.id,
        studentFirstName: student.firstName,
        studentLastName: student.lastName,
        overallAverage: overallAverage,
        outcomeAverages: outcomeAverages,
        topContentGroups: topContentGroups,
        bottomContentGroups: bottomContentGroups
    };
}

// --- Page Component Props Interface ---

interface ClassReportPageProps {
  // Remove params
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>; // Use searchParams
}

// --- Page Component ---

export default async function ClassReportPage({ searchParams: searchParamsPromise }: ClassReportPageProps) {
  const searchParams = await searchParamsPromise;
  // Handle potential arrays from searchParams
  const rawClassId = Array.isArray(searchParams.classId) ? searchParams.classId[0] : searchParams.classId;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/sign-in');
  }

  // --- Get classId from searchParams --- 
  let classId: string | null = null;
  if (rawClassId) {
    classId = rawClassId;
  }

  // Handle case where no valid classId is provided
  if (classId === null) {
    // You might want to fetch user's classes here to suggest one
    // Or just show a message prompting selection from the global selector
    return (
        <div className="p-4 text-center">
            <p>Please select a class from the dropdown above to view its report.</p>
            {/* Optional: Add more context if needed */}
        </div>
    );
  }

  // --- Authorization Check (Example - Adapt as needed) ---
  // const isAuthorized = await checkTeacherAuthorization(classId, user.id);
  // if (!isAuthorized) {
  //     // Or check if user is part of the same team etc.
  //     console.error(`User ${user.id} not authorized for class ${classId}`);
  //     return <div>Error: You are not authorized to view this class report.</div>; 
  // }

  // --- Data Fetching (Uses the validated classId) ---
  const classData = await getClassDetails(classId);
  if (!classData || !classData.stageId) { // Ensure stageId exists for hierarchy fetching
    console.error(`Class data or stageId not found for classId: ${classId}`);
    notFound(); 
  }

  const [enrollments, hierarchyData, gradeScalesData] = await Promise.all([
    getAllStudentEnrollmentsForClass(classId),
    getFullCurriculumHierarchy(classData.stageId),
    getGradeScalesForTeam(classData.teamId) // Assuming teamId is on classData
  ]);

  // --- Fetch Assessments for all students (Can be parallelized further) ---
  const assessmentsPromises = enrollments.map(enrollment => 
      getStudentAssessmentsForEnrollment(enrollment.id).then(assessments => ({ 
          enrollmentId: enrollment.id, 
          assessments 
      }))
  );
  const allAssessmentsResults = await Promise.all(assessmentsPromises);
  const assessmentsByEnrollmentId = new Map(allAssessmentsResults.map(r => [r.enrollmentId, r.assessments]));
  console.log(`Fetched assessments for ${assessmentsByEnrollmentId.size} enrollments.`);

  // --- Process Data for Each Student ---
  const studentReportData: ProcessedStudentReportData[] = enrollments.map(enrollment => {
      const studentAssessments = assessmentsByEnrollmentId.get(enrollment.id) || [];
      console.log(`Processing student ${enrollment.student.id} with ${studentAssessments.length} assessments.`);
      return processStudentGradesForReport(
          enrollment.student,
          hierarchyData,
          studentAssessments,
          gradeScalesData
      );
  });

  // --- Extract Outcome Headers for the Table ---
  // Get unique outcomes from the hierarchy (more reliable than processing results)
  const outcomeHeadersMap = new Map<number, string>();
  hierarchyData.forEach(item => {
      if (item.outcomeId && item.outcomeName && !outcomeHeadersMap.has(item.outcomeId)) {
          outcomeHeadersMap.set(item.outcomeId, item.outcomeName);
      }
  });
  const outcomeHeaders = Array.from(outcomeHeadersMap.entries()).map(([id, name]) => ({ id, name }))
                           .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically for consistency

  console.log("Server Component: Passing", studentReportData.length, "processed students to client.");
  
  // --- Pass to Client Component ---
  return (
      <div className="p-4">
          <h1 className="text-2xl font-semibold mb-1">
              Class Report: {classData.name}
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
               (Stage {classData.stage?.name})
          </p>
          <hr className="mb-6"/>
          <ClassReportClient 
              classId={classId}
              studentReportData={studentReportData}
              outcomeHeaders={outcomeHeaders}
           />
      </div>
  );
} 