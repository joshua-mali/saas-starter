'use server';

import { db } from '@/lib/db/drizzle';
import { classes, classTeachers, teamMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Fetch classes for the current user/teacher
export async function getTeacherClasses(userId: string) {
  const teacherClasses = await db
    .select({
      id: classes.id,
      name: classes.name,
      // Add other fields if needed by the client
    })
    .from(classes)
    .innerJoin(classTeachers, eq(classes.id, classTeachers.classId))
    .where(eq(classTeachers.teacherId, userId))
    .orderBy(classes.name); // Order alphabetically

  return teacherClasses;
}

// Fetch the team ID for a given user
export async function getUserTeam(userId: string): Promise<number | null> {
  const teamMember = await db
    .select({
      teamId: teamMembers.teamId,
    })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1);

  return teamMember.length > 0 ? teamMember[0].teamId : null;
}

// Fetch all classes for a given team
export async function getTeamClasses(teamId: number) {
  const teamClasses = await db
    .select({
      id: classes.id,
      name: classes.name,
    })
    .from(classes)
    .where(eq(classes.teamId, teamId))
    .orderBy(classes.name);

  return teamClasses;
} 