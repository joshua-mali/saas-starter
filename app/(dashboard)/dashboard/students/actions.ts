'use server'

import { db } from '@/lib/db/drizzle'
import {
  studentEnrollments,
  students,
  teamMembers,
  type Student, // Import the specific type if needed
} from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Schema for adding a student
const addStudentSchema = z.object({
  classId: z.coerce.number().int().positive('Valid Class ID is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().optional(), // Assuming date string from input type=date
})

interface ActionResult {
  error?: string | null
  success?: boolean
}

// --- Action to get students for a specific class --- (Called from Client Component)
export async function getStudentsForClass(classId: number): Promise<{
  // Adjust return type to match the new select structure
  students: { student: Student; enrollmentStatus: string | null }[] | null
  error: string | null
}> {
  if (!classId || typeof classId !== 'number' || classId <= 0) {
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
    classId: number // Add classId parameter
): Promise<BatchActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'User not authenticated' };
    }

    if (!classId || typeof classId !== 'number') {
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