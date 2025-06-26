export const dynamic = "force-dynamic";

import { getTeacherClasses, getTeamClasses, getUserTeam } from '@/app/actions/get-classes';
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

async function getClassDetails(classId: string): Promise<(Class & { stage: Stage | null, teamId: number }) | null> {
  const result = await db.query.classes.findFirst({
    where: eq(classes.id, classId),
    with: {
      stage: true,
    }
  });
  return result ? { ...result, teamId: result.teamId } : null;
}

async function getTermsForYear(teamId: number, calendarYear: number): Promise<Term[]> {
  return db.select().from(terms)
    .where(and(eq(terms.teamId, teamId), eq(terms.calendarYear, calendarYear)))
    .orderBy(terms.termNumber);
}

async function getContentGroupsForStage(stageId: number) {
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

  return results;
}

type ContentGroupWithContext = Awaited<ReturnType<typeof getContentGroupsForStage>>[0];

async function getExistingPlan(classId: string): Promise<ClassCurriculumPlanItem[]> {
  return db.select().from(classCurriculumPlan)
    .where(eq(classCurriculumPlan.classId, classId));
}

// --- Page Component Props Interface ---

interface PlanningPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// --- Page Component ---

export default async function PlanningPage({ searchParams: searchParamsPromise }: PlanningPageProps) {
  const searchParams = await searchParamsPromise;
  // Handle potential arrays from searchParams
  const rawClassId = Array.isArray(searchParams.classId) ? searchParams.classId[0] : searchParams.classId;

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
        <div className="p-4 text-center">
            <p>Please select a class from the dropdown above to view the planning board.</p>
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

  const classData = await getClassDetails(classId);
  if (!classData) {
    notFound();
  }

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
      currentClassId={classId}
    />
  );
} 