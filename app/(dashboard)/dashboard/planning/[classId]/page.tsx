export const dynamic = "force-dynamic";

import { db } from '@/lib/db/drizzle';
import {
  classCurriculumPlan,
  classes,
  classTeachers,
  contentGroups,
  focusAreas,
  focusGroups,
  outcomes,
  subjects,
  terms,
  type Class,
  type ClassCurriculumPlanItem,
  type Stage,
  type Term
} from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import PlanningBoardClient from './client'; // Client component for the board

// --- Data Fetching Functions ---

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

async function getClassDetails(classId: number): Promise<(Class & { stage: Stage | null, teamId: number }) | null> {
  // Authorization is now checked separately
  const result = await db.query.classes.findFirst({
    where: eq(classes.id, classId),
    with: {
      stage: true, // Include stage details
    }
  });
  return result ? { ...result, teamId: result.teamId } : null; // Ensure teamId is included
}

async function getTermsForYear(teamId: number, calendarYear: number): Promise<Term[]> {
  return db.select().from(terms)
    .where(and(eq(terms.teamId, teamId), eq(terms.calendarYear, calendarYear)))
    .orderBy(terms.termNumber);
}

async function getContentGroupsForStage(stageId: number) {
  // Fetch content groups relevant to the class's stage
  // Requires joining up the hierarchy
  const results = await db.select({
    contentGroupId: contentGroups.id,
    contentGroupName: contentGroups.name,
    focusGroupId: focusGroups.id,
    focusGroupName: focusGroups.name,
    focusAreaId: focusAreas.id,
    focusAreaName: focusAreas.name,
    outcomeId: outcomes.id,
    outcomeName: outcomes.name,
    subjectId: subjects.id,
    subjectName: subjects.name,
  })
    .from(contentGroups)
    .innerJoin(focusGroups, eq(contentGroups.focusGroupId, focusGroups.id))
    .innerJoin(focusAreas, eq(focusGroups.focusAreaId, focusAreas.id))
    .innerJoin(outcomes, eq(focusAreas.outcomeId, outcomes.id))
    .innerJoin(subjects, eq(outcomes.subjectId, subjects.id))
    .where(eq(focusAreas.stageId, stageId))
    .orderBy(subjects.name, outcomes.name, focusAreas.name, focusGroups.name, contentGroups.name);

  // Process results into a more usable structure if needed, e.g., grouped by subject
  // For now, return the flat list
  return results;
}

type ContentGroupWithContext = Awaited<ReturnType<typeof getContentGroupsForStage>>[0];

async function getExistingPlan(classId: number): Promise<ClassCurriculumPlanItem[]> {
  return db.select().from(classCurriculumPlan)
    .where(eq(classCurriculumPlan.classId, classId));
}

// --- Page Component Props Interface ---

interface PlanningPageProps {
  params: Promise<{
    classId: string; // From dynamic route
  }>;
  // No searchParams needed for this page currently
}

// --- Page Component ---

export default async function PlanningPage(props: PlanningPageProps) {
  const params = await props.params;

  const {
    classId: rawClassId
  } = params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/sign-in');
  }

  // rawClassId is directly available here
  const classId = parseInt(rawClassId, 10);
  if (isNaN(classId)) {
    notFound(); // Invalid classId parameter
  }

  // --- Authorization Check ---
  const isAuthorized = await checkTeacherAuthorization(classId, user.id);
  if (!isAuthorized) {
    notFound(); // User is not a teacher for this class
  }

  // Fetch class details (already authorized)
  const classData = await getClassDetails(classId);
  if (!classData) {
    // This shouldn't happen if authorization passed, but good practice
    notFound();
  }

  // Fetch necessary data concurrently
  const [termsData, contentGroupsData, existingPlanData] = await Promise.all([
    getTermsForYear(classData.teamId, classData.calendarYear),
    getContentGroupsForStage(classData.stageId),
    getExistingPlan(classId),
  ]);

  return (
    <PlanningBoardClient
      classData={classData}
      terms={termsData}
      availableContentGroups={contentGroupsData}
      initialPlanItems={existingPlanData}
    />
  );
} 