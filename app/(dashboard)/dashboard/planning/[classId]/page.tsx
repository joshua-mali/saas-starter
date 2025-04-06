import { db } from '@/lib/db/drizzle';
import {
    classCurriculumPlan,
    classes,
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

async function getClassDetails(classId: number, userId: string): Promise<(Class & { stage: Stage | null, teamId: number }) | null> {
  // Fetch class and verify the user is a teacher for it
  const result = await db.query.classes.findFirst({
      where: and(
          eq(classes.id, classId),
          // Ensure the current user is teaching this class (exists in classTeachers)
          // This requires a subquery or join, simplified here - add proper auth check!
          // eq(classes.teamId, ...) // Might need team check too
      ),
      with: {
          stage: true, // Include stage details
      }
  });
  // TODO: Implement proper authorization check to ensure userId teaches classId
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

// --- Page Component --- 

interface PlanningPageProps {
  params: {
    classId: string; // From dynamic route
  };
}

export default async function PlanningPage({ params }: PlanningPageProps) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/sign-in');
  }

  const classId = parseInt(params.classId, 10);
  if (isNaN(classId)) {
    notFound(); // Invalid classId parameter
  }

  // Fetch class details (includes auth check placeholder)
  const classData = await getClassDetails(classId, user.id);
  if (!classData) {
    notFound(); // Class not found or user not authorized
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