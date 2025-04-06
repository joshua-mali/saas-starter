import { db } from '@/lib/db/drizzle';
import { classes, classTeachers, stages } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { asc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import ClassesPageClient from './client';

// Fetch classes for the current user/teacher
async function getTeacherClasses(userId: string) {
  const teacherClasses = await db
    .select({
      id: classes.id,
      name: classes.name,
      calendarYear: classes.calendarYear,
      isActive: classes.isActive,
      createdAt: classes.createdAt,
      updatedAt: classes.updatedAt,
      teamId: classes.teamId,
      stageId: classes.stageId,
      stage: {
        name: stages.name,
      },
    })
    .from(classes)
    .innerJoin(classTeachers, eq(classes.id, classTeachers.classId))
    .innerJoin(stages, eq(classes.stageId, stages.id))
    .where(eq(classTeachers.teacherId, userId))
    .orderBy(classes.calendarYear, classes.name);

  return teacherClasses;
}

// Fetch all available stages for the dropdown
async function getAllStages() {
  const allStages = await db.select().from(stages).orderBy(asc(stages.id));
  return allStages;
}

export default async function ClassesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect('/sign-in');
  }

  // Fetch both classes and stages concurrently
  const [userClasses, availableStages] = await Promise.all([
    getTeacherClasses(data.user.id),
    getAllStages(),
  ]);

  // Pass stages to the client component
  return <ClassesPageClient classes={userClasses} stages={availableStages} />;
} 