'use server'

import { db } from '@/lib/db/drizzle'
import {
    classCurriculumPlan,
    classTeachers,
    classes,
    gradeScales,
    studentAssessments,
    studentEnrollments,
    teamMembers
} from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createClassSchema = z.object({
  className: z.string().min(1, 'Class name is required'),
  calendarYear: z.coerce
    .number()
    .int()
    .min(2000, 'Please enter a valid year (e.g., 2025)')
    .max(2100, 'Please enter a valid year'),
  stageId: z.coerce.number().int().positive('Stage selection is required'),
})

// --- Schemas ---
const updateClassSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
  className: z.string().min(1, 'Class name is required').max(100, 'Class name too long'),
  calendarYear: z.coerce
    .number()
    .int()
    .min(2000, 'Please enter a valid year (e.g., 2025)')
    .max(2100, 'Please enter a valid year'),
  stageId: z.coerce.number().int().positive('Stage selection is required'),
})

const deleteClassSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
})

interface ActionResult {
  error: string | null
  success?: boolean
}

// Default grade scales to create for each new class
const DEFAULT_GRADE_SCALES = [
  { name: 'Elementary', numericValue: 1, description: 'Student demonstrates elementary achievement of knowledge, understanding and skills' },
  { name: 'Basic', numericValue: 2, description: 'Student demonstrates basic achievement of knowledge, understanding and skills' },
  { name: 'Sound', numericValue: 3, description: 'Student demonstrates sound achievement of knowledge, understanding and skills' },
  { name: 'Thorough', numericValue: 4, description: 'Student demonstrates thorough achievement of knowledge, understanding and skills' },
  { name: 'Extensive', numericValue: 5, description: 'Student demonstrates extensive achievement of knowledge, understanding and skills' },
]

// --- Helper: Check if user can modify class ---
async function canUserModifyClass(userId: string, classId: string): Promise<boolean> {
  try {
    const result = await db
      .select({ teacherId: classTeachers.teacherId })
      .from(classTeachers)
      .where(eq(classTeachers.classId, classId))
      .limit(1)

    return result.some(teacher => teacher.teacherId === userId)
  } catch (error) {
    console.error('Error checking class permissions:', error)
    return false
  }
}

// --- Helper: Get class deletion impact ---
async function getClassDeletionImpact(classId: string) {
  try {
    const [studentsCount, assessmentsCount, plansCount] = await Promise.all([
      // Count enrolled students
      db.select({ count: eq(studentEnrollments.classId, classId) })
        .from(studentEnrollments)
        .where(eq(studentEnrollments.classId, classId)),
      
      // Count assessments through enrollments
      db.select({ count: eq(studentEnrollments.classId, classId) })
        .from(studentAssessments)
        .innerJoin(studentEnrollments, eq(studentAssessments.studentEnrollmentId, studentEnrollments.id))
        .where(eq(studentEnrollments.classId, classId)),
      
      // Count curriculum plans
      db.select({ count: eq(classCurriculumPlan.classId, classId) })
        .from(classCurriculumPlan)
        .where(eq(classCurriculumPlan.classId, classId))
    ])

    return {
      studentsCount: studentsCount.length,
      assessmentsCount: assessmentsCount.length,
      plansCount: plansCount.length
    }
  } catch (error) {
    console.error('Error getting deletion impact:', error)
    return { studentsCount: 0, assessmentsCount: 0, plansCount: 0 }
  }
}

// --- Server Actions ---

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
    // Use a transaction to ensure both class and grade scales are created together
    const result = await db.transaction(async (tx) => {
      // Insert the new class using calendarYear and stageId
      const [newClass] = await tx
        .insert(classes)
        .values({
          teamId: teamId,
          calendarYear: calendarYear,
          stageId: stageId,
          name: className,
        })
        .returning({ id: classes.id })

      if (!newClass || !newClass.id) {
        throw new Error('Failed to create class record.')
      }

      // Add the current user as a teacher for this class
      await tx.insert(classTeachers).values({
        classId: newClass.id,
        teacherId: user.id,
        isPrimary: true, // Make the creator the primary teacher by default
      })

      // Create default grade scales for the new class
      const gradeScalesToInsert = DEFAULT_GRADE_SCALES.map(scale => ({
        classId: newClass.id,
        name: scale.name,
        numericValue: scale.numericValue,
        description: scale.description,
      }))

      await tx.insert(gradeScales).values(gradeScalesToInsert)
      console.log(`Created ${gradeScalesToInsert.length} grade scales for class ${newClass.id}`)

      return newClass.id
    })

    revalidatePath('/dashboard/classes') // Revalidate the path to show the new class
    return { error: null, success: true }
  } catch (error) {
    console.error('Error creating class:', error)
    return { error: 'An unexpected error occurred while creating the class.' }
  }
}

export async function updateClass(
  prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  console.log('[updateClass] Starting with form data:', Object.fromEntries(formData))
  
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.error('[updateClass] User not authenticated')
    return { error: 'User not authenticated' }
  }

  const validatedFields = updateClassSchema.safeParse({
    classId: formData.get('classId'),
    className: formData.get('className'),
    calendarYear: formData.get('calendarYear'),
    stageId: formData.get('stageId'),
  })

  if (!validatedFields.success) {
    console.error('[updateClass] Validation failed:', validatedFields.error.flatten())
    const fieldErrors = validatedFields.error.flatten().fieldErrors
    return {
      error: fieldErrors.classId?.[0] ||
             fieldErrors.className?.[0] ||
             fieldErrors.calendarYear?.[0] ||
             fieldErrors.stageId?.[0] ||
             'Validation failed',
    }
  }

  const { classId, className, calendarYear, stageId } = validatedFields.data

  // Check authorization
  const canModify = await canUserModifyClass(user.id, classId)
  if (!canModify) {
    console.error('[updateClass] User not authorized to modify class:', classId)
    return { error: 'You are not authorized to modify this class.' }
  }

  try {
    const [updatedClass] = await db
      .update(classes)
      .set({
        name: className,
        calendarYear: calendarYear,
        stageId: stageId,
        updatedAt: new Date(),
      })
      .where(eq(classes.id, classId))
      .returning({ id: classes.id })

    if (!updatedClass) {
      console.error('[updateClass] Class not found:', classId)
      return { error: 'Class not found.' }
    }

    console.log('[updateClass] Class updated successfully:', updatedClass.id)
    revalidatePath('/dashboard/classes')
    return { error: null, success: true }
  } catch (error) {
    console.error('[updateClass] Database error:', error)
    return { error: 'An unexpected error occurred while updating the class.' }
  }
}

export async function deleteClass(
  prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  console.log('[deleteClass] Starting with form data:', Object.fromEntries(formData))
  
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.error('[deleteClass] User not authenticated')
    return { error: 'User not authenticated' }
  }

  const validatedFields = deleteClassSchema.safeParse({
    classId: formData.get('classId'),
  })

  if (!validatedFields.success) {
    console.error('[deleteClass] Validation failed:', validatedFields.error.flatten())
    return { error: 'Invalid class ID provided.' }
  }

  const { classId } = validatedFields.data

  // Check authorization
  const canModify = await canUserModifyClass(user.id, classId)
  if (!canModify) {
    console.error('[deleteClass] User not authorized to delete class:', classId)
    return { error: 'You are not authorized to delete this class.' }
  }

  try {
    // Get deletion impact for logging
    const impact = await getClassDeletionImpact(classId)
    console.log('[deleteClass] Deletion impact:', impact)

    // Delete the class (cascade deletes will handle related records)
    const [deletedClass] = await db
      .delete(classes)
      .where(eq(classes.id, classId))
      .returning({ id: classes.id, name: classes.name })

    if (!deletedClass) {
      console.error('[deleteClass] Class not found:', classId)
      return { error: 'Class not found.' }
    }

    console.log('[deleteClass] Class deleted successfully:', {
      id: deletedClass.id,
      name: deletedClass.name,
      impact
    })
    
    revalidatePath('/dashboard/classes')
    return { error: null, success: true }
  } catch (error) {
    console.error('[deleteClass] Database error:', error)
    return { error: 'An unexpected error occurred while deleting the class.' }
  }
}

// --- Helper: Get deletion impact for client warning ---
export async function getClassDeletionInfo(classId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'User not authenticated' }
  }

  // Check authorization
  const canModify = await canUserModifyClass(user.id, classId)
  if (!canModify) {
    return { error: 'You are not authorized to view this class information.' }
  }

  try {
    const impact = await getClassDeletionImpact(classId)
    return { error: null, ...impact }
  } catch (error) {
    console.error('Error getting class deletion info:', error)
    return { error: 'Failed to get class information.' }
  }
} 