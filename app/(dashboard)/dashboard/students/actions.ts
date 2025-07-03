'use server'

import { db } from '@/lib/db/drizzle'
import {
    classTeachers,
    studentAssessments,
    studentEnrollments,
    students,
    teacherComments,
    teamMembers,
    type Student, // Import the specific type if needed
} from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Schema for adding a student
const addStudentSchema = z.object({
  classId: z.string().uuid('Valid Class ID is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().optional(), // Assuming date string from input type=date
})

// --- Additional Schemas for Edit and Delete ---
const updateStudentSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  dateOfBirth: z.string().optional().nullable(), // Date as string from form
  externalId: z.string().max(100, 'External ID too long').optional().nullable(),
})

const deleteStudentSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
})

interface ActionResult {
  error?: string | null
  success?: boolean
}

// --- Action to get students for a specific class --- (Called from Client Component)
export async function getStudentsForClass(classId: string): Promise<{
  // Adjust return type to match the new select structure
  students: { student: Student; enrollmentStatus: string | null }[] | null
  error: string | null
}> {
  if (!classId || typeof classId !== 'string') {
    return { students: null, error: 'Invalid Class ID provided.' }
  }

  try {
    // TODO: Add authorization check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
       return { students: null, error: 'User not authenticated.' }
    }

    // Corrected select statement
    const classStudentsData = await db
      .select({
        student: students, // Select the whole student object
        enrollmentStatus: studentEnrollments.status, // Select the specific status
      })
      .from(students)
      .innerJoin(studentEnrollments, eq(students.id, studentEnrollments.studentId))
      .where(eq(studentEnrollments.classId, classId))
      .orderBy(students.lastName, students.firstName)

    return { students: classStudentsData, error: null }

  } catch (error) {
    console.error('Error fetching students for class:', error)
    return { students: null, error: 'Failed to fetch students.' }
  }
}

// --- Action to add a student to a class --- (Called from Form)
export async function addStudentToClass(
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
  const [userTeam] = await db.select({ teamId: teamMembers.teamId })
                         .from(teamMembers)
                         .where(eq(teamMembers.userId, user.id))
                         .limit(1);

  if (!userTeam || typeof userTeam.teamId !== 'number') {
    return { error: 'User is not associated with a team.' }
  }
  const teamId = userTeam.teamId;

  // Validate form data
  const validatedFields = addStudentSchema.safeParse({
    classId: formData.get('classId'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    dateOfBirth: formData.get('dateOfBirth'),
  })

  if (!validatedFields.success) {
    const fieldErrors = validatedFields.error.flatten().fieldErrors;
    return {
      error: fieldErrors.classId?.[0] ||
             fieldErrors.firstName?.[0] ||
             fieldErrors.lastName?.[0] ||
             'Validation failed',
    }
  }

  const { classId, firstName, lastName, dateOfBirth } = validatedFields.data

  try {
    // TODO: Add authorization check - ensure user has access to this classId

    // 1. Insert the student record
    const [newStudent] = await db
      .insert(students)
      .values({
        teamId: teamId,
        firstName: firstName,
        lastName: lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null, // Convert string to Date
      })
      .returning({ id: students.id })

    if (!newStudent || !newStudent.id) {
      return { error: 'Failed to create student record.' }
    }

    // 2. Create the enrollment record
    await db.insert(studentEnrollments).values({
      studentId: newStudent.id,
      classId: classId,
      // enrollmentDate is default now()
      // status is default 'active'
    })

    revalidatePath('/dashboard/students') // Or maybe a more specific revalidation?
    return { success: true, error: null }

  } catch (error) {
    console.error('Error adding student:', error)
    // Could check for specific DB errors like unique constraints if needed
    return { error: 'An unexpected error occurred while adding the student.' }
  }
}

// --- New Action: Add Students in Batch from CSV data ---

// Schema for a single student in the batch
const studentBatchInputSchema = z.object({
  firstName: z.string().min(1, 'First name cannot be empty'),
  lastName: z.string().min(1, 'Last name cannot be empty'),
  // Add other optional fields if needed from CSV in the future
});

// Schema for the entire batch
const addStudentsBatchSchema = z.array(studentBatchInputSchema);

interface BatchActionResult {
    error?: string | null;
    success?: boolean;
    addedCount?: number;
    errorDetails?: { index: number; error: string }[];
}

export async function addStudentsBatch(
    studentsData: { firstName: string; lastName: string }[],
    classId: string // Add classId parameter
): Promise<BatchActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'User not authenticated' };
    }

    if (!classId || typeof classId !== 'string') {
        return { error: 'Invalid Class ID provided for enrollment.' };
    }

    // Get the user's team
    const [userTeam] = await db.select({ teamId: teamMembers.teamId })
                           .from(teamMembers)
                           .where(eq(teamMembers.userId, user.id))
                           .limit(1);

    if (!userTeam || typeof userTeam.teamId !== 'number') {
        return { error: 'User is not associated with a team.' };
    }
    const teamId = userTeam.teamId;

    // Validate the incoming data array
    const validatedData = addStudentsBatchSchema.safeParse(studentsData);

    if (!validatedData.success) {
        console.error('Batch validation failed:', validatedData.error.flatten());
        return { error: 'Invalid student data provided in the batch.' };
    }

    // Prepare data for student insertion (add teamId)
    const studentsToInsert = validatedData.data.map(student => ({
        ...student,
        teamId: teamId,
    }));

    if (studentsToInsert.length === 0) {
        return { error: 'No valid students to add.' };
    }

    try {
        // 1. Perform bulk student insert
        const insertedStudents = await db.insert(students)
                                      .values(studentsToInsert)
                                      .returning({ id: students.id });

        const addedCount = insertedStudents.length;
        if (addedCount === 0) {
             return { error: 'Failed to insert any student records.' };
        }
        console.log(`Successfully inserted ${addedCount} students for team ${teamId}`);

        // 2. Prepare data for enrollment insertion
        const enrollmentsToInsert = insertedStudents.map(student => ({
            studentId: student.id,
            classId: classId,
            // Defaults for status and enrollmentDate are handled by the DB schema
        }));

        // 3. Perform bulk enrollment insert
        await db.insert(studentEnrollments).values(enrollmentsToInsert);
        console.log(`Successfully enrolled ${addedCount} students into class ${classId}`);

        // Revalidate relevant paths
        revalidatePath('/dashboard/students'); // Revalidates the page data source
        // Optionally, revalidate the specific class grading page if needed immediately
        revalidatePath(`/dashboard/grading/${classId}`);

        return { success: true, addedCount: addedCount };

    } catch (error: any) {
        console.error('Error during batch student insert/enroll:', error);
        if (error.code === '23505') { // Handle potential unique violations (e.g., student already enrolled)
             return { error: 'Database error: Could not enroll students. Some might already exist or be enrolled.' };
        }
        return { error: 'An unexpected error occurred during the import.' };
    }
}

// --- Helper: Check if user can modify student ---
async function canUserModifyStudent(userId: string, studentId: string): Promise<boolean> {
  try {
    // Check if user is a teacher of any class where this student is enrolled
    const result = await db
      .select({ teacherId: classTeachers.teacherId })
      .from(classTeachers)
      .innerJoin(studentEnrollments, eq(classTeachers.classId, studentEnrollments.classId))
      .where(eq(studentEnrollments.studentId, studentId))
      .limit(1)

    return result.some(teacher => teacher.teacherId === userId)
  } catch (error) {
    console.error('Error checking student permissions:', error)
    return false
  }
}

// --- Helper: Get student deletion impact ---
async function getStudentDeletionImpact(studentId: string) {
  try {
    const [enrollmentsCount, assessmentsCount, commentsCount] = await Promise.all([
      // Count enrollments
      db.select({ count: eq(studentEnrollments.studentId, studentId) })
        .from(studentEnrollments)
        .where(eq(studentEnrollments.studentId, studentId)),
      
      // Count assessments through enrollments
      db.select({ count: eq(studentEnrollments.studentId, studentId) })
        .from(studentAssessments)
        .innerJoin(studentEnrollments, eq(studentAssessments.studentEnrollmentId, studentEnrollments.id))
        .where(eq(studentEnrollments.studentId, studentId)),
      
      // Count teacher comments
      db.select({ count: eq(teacherComments.studentId, studentId) })
        .from(teacherComments)
        .where(eq(teacherComments.studentId, studentId))
    ])

    return {
      enrollmentsCount: enrollmentsCount.length,
      assessmentsCount: assessmentsCount.length,
      commentsCount: commentsCount.length
    }
  } catch (error) {
    console.error('Error getting deletion impact:', error)
    return { enrollmentsCount: 0, assessmentsCount: 0, commentsCount: 0 }
  }
}

// --- Server Actions ---

export async function updateStudent(
  prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  console.log('[updateStudent] Starting with form data:', Object.fromEntries(formData))
  
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.error('[updateStudent] User not authenticated')
    return { error: 'User not authenticated' }
  }

  const validatedFields = updateStudentSchema.safeParse({
    studentId: formData.get('studentId'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    dateOfBirth: formData.get('dateOfBirth'),
    externalId: formData.get('externalId'),
  })

  if (!validatedFields.success) {
    console.error('[updateStudent] Validation failed:', validatedFields.error.flatten())
    const fieldErrors = validatedFields.error.flatten().fieldErrors
    return {
      error: fieldErrors.studentId?.[0] ||
             fieldErrors.firstName?.[0] ||
             fieldErrors.lastName?.[0] ||
             fieldErrors.dateOfBirth?.[0] ||
             fieldErrors.externalId?.[0] ||
             'Validation failed',
    }
  }

  const { studentId, firstName, lastName, dateOfBirth, externalId } = validatedFields.data

  // Check authorization
  const canModify = await canUserModifyStudent(user.id, studentId)
  if (!canModify) {
    console.error('[updateStudent] User not authorized to modify student:', studentId)
    return { error: 'You are not authorized to modify this student.' }
  }

  try {
    const [updatedStudent] = await db
      .update(students)
      .set({
        firstName: firstName,
        lastName: lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        externalId: externalId || null,
        updatedAt: new Date(),
      })
      .where(eq(students.id, studentId))
      .returning({ id: students.id })

    if (!updatedStudent) {
      console.error('[updateStudent] Student not found:', studentId)
      return { error: 'Student not found.' }
    }

    console.log('[updateStudent] Student updated successfully:', updatedStudent.id)
    revalidatePath('/dashboard/students')
    return { error: null, success: true }
  } catch (error) {
    console.error('[updateStudent] Database error:', error)
    return { error: 'An unexpected error occurred while updating the student.' }
  }
}

export async function deleteStudent(
  prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  console.log('[deleteStudent] Starting with form data:', Object.fromEntries(formData))
  
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.error('[deleteStudent] User not authenticated')
    return { error: 'User not authenticated' }
  }

  const validatedFields = deleteStudentSchema.safeParse({
    studentId: formData.get('studentId'),
  })

  if (!validatedFields.success) {
    console.error('[deleteStudent] Validation failed:', validatedFields.error.flatten())
    return { error: 'Invalid student ID provided.' }
  }

  const { studentId } = validatedFields.data

  // Check authorization
  const canModify = await canUserModifyStudent(user.id, studentId)
  if (!canModify) {
    console.error('[deleteStudent] User not authorized to delete student:', studentId)
    return { error: 'You are not authorized to delete this student.' }
  }

  try {
    // Get deletion impact for logging
    const impact = await getStudentDeletionImpact(studentId)
    console.log('[deleteStudent] Deletion impact:', impact)

    // Delete the student (cascade deletes will handle related records)
    const [deletedStudent] = await db
      .delete(students)
      .where(eq(students.id, studentId))
      .returning({ id: students.id, firstName: students.firstName, lastName: students.lastName })

    if (!deletedStudent) {
      console.error('[deleteStudent] Student not found:', studentId)
      return { error: 'Student not found.' }
    }

    console.log('[deleteStudent] Student deleted successfully:', {
      id: deletedStudent.id,
      name: `${deletedStudent.firstName} ${deletedStudent.lastName}`,
      impact
    })
    
    revalidatePath('/dashboard/students')
    return { error: null, success: true }
  } catch (error) {
    console.error('[deleteStudent] Database error:', error)
    return { error: 'An unexpected error occurred while deleting the student.' }
  }
}

// --- Helper: Get deletion impact for client warning ---
export async function getStudentDeletionInfo(studentId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'User not authenticated' }
  }

  // Check authorization
  const canModify = await canUserModifyStudent(user.id, studentId)
  if (!canModify) {
    return { error: 'You are not authorized to view this student information.' }
  }

  try {
    const impact = await getStudentDeletionImpact(studentId)
    return { error: null, ...impact }
  } catch (error) {
    console.error('Error getting student deletion info:', error)
    return { error: 'Failed to get student information.' }
  }
} 