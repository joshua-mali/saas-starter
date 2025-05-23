'use server'

import { db } from '@/lib/db/drizzle'
import { classTeachers, classes, teamMembers } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createClassSchema = z.object({
  className: z.string().min(1, 'Class name is required'),
  calendarYear: z.coerce
    .number()
    .int()
    .min(2000, 'Please enter a valid year (e.g., 2024)')
    .max(2100, 'Please enter a valid year'),
  stageId: z.coerce.number().int().positive('Stage selection is required'),
})

interface ActionResult {
  error: string | null
  success?: boolean
}

export async function createClass(
  prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'User not authenticated' }
  }

  // Get the user's team directly
  let userTeam: { teamId: number } | undefined;
  try {
    [userTeam] = await db.select({ teamId: teamMembers.teamId })
                         .from(teamMembers)
                         .where(eq(teamMembers.userId, user.id))
                         .limit(1);
  } catch (dbError) {
     console.error('Database error fetching team member:', dbError);
     return { error: 'Failed to retrieve team information.' };
  }

  if (!userTeam || typeof userTeam.teamId !== 'number') {
    // Optional: Check if they own a team even if not in teamMembers yet (e.g., first user)
    // Add logic here if needed based on your Basejump/team setup
    console.warn(`User ${user.id} does not have a team associated in team_members.`);
    return { error: 'User is not associated with a team.' }
  }

  const teamId = userTeam.teamId;

  const validatedFields = createClassSchema.safeParse({
    className: formData.get('className'),
    calendarYear: formData.get('calendarYear'),
    stageId: formData.get('stageId'),
  })

  if (!validatedFields.success) {
    const fieldErrors = validatedFields.error.flatten().fieldErrors;
    return {
      error: fieldErrors.className?.[0] ||
             fieldErrors.calendarYear?.[0] ||
             fieldErrors.stageId?.[0] ||
             'Validation failed',
    }
  }

  const { className, calendarYear, stageId } = validatedFields.data

  try {
    // Insert the new class using calendarYear and stageId
    const [newClass] = await db
      .insert(classes)
      .values({
        teamId: teamId,
        calendarYear: calendarYear,
        stageId: stageId,
        name: className,
      })
      .returning({ id: classes.id })

    if (!newClass || !newClass.id) {
      return { error: 'Failed to create class record.' }
    }

    // 4. Add the current user as a teacher for this class
    await db.insert(classTeachers).values({
      classId: newClass.id,
      teacherId: user.id,
      isPrimary: true, // Make the creator the primary teacher by default
    })

    revalidatePath('/dashboard/classes') // Revalidate the path to show the new class
    return { error: null, success: true }
  } catch (error) {
    console.error('Error creating class:', error)
    return { error: 'An unexpected error occurred while creating the class.' }
  }
} 