'use server'

import { getUserTeam } from '@/app/actions/get-classes'
import { db } from '@/lib/db/drizzle'
import { teacherComments } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// --- Schemas ---
const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title must be 255 characters or less"),
  content: z.string().min(1, "Content is required"),
  isPrivate: z.boolean().default(true),
})

const updateNoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(255, "Title must be 255 characters or less"),
  content: z.string().min(1, "Content is required"),
  isPrivate: z.boolean().default(true),
})

const deleteNoteSchema = z.object({
  id: z.string().uuid(),
})

// --- Action Result Type ---
export interface ActionResult {
  error?: string | null
  success?: boolean
  message?: string
}

// --- Helper: Check Authorization ---
async function getCurrentUserAndTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'User not authenticated' }
  }

  const teamId = await getUserTeam(user.id)
  if (!teamId) {
    return { error: 'User not part of any team' }
  }

  return { user, teamId }
}

// --- Server Actions ---

export async function createGeneralNote(rawData: unknown): Promise<ActionResult> {
  const authResult = await getCurrentUserAndTeam()
  if ('error' in authResult) {
    return { error: authResult.error }
  }
  
  const { user, teamId } = authResult

  const validatedFields = createNoteSchema.safeParse(rawData)
  if (!validatedFields.success) {
    return { error: 'Invalid data for creating note.' }
  }

  const { title, content, isPrivate } = validatedFields.data

  try {
    await db.insert(teacherComments).values({
      teamId,
      authorId: user.id,
      commentType: 'general',
      studentId: null,
      classId: null,
      title,
      content,
      isPrivate,
    })

    revalidatePath('/dashboard/notes')
    return { success: true, message: 'Note created successfully' }

  } catch (error) {
    console.error('Error creating note:', error)
    return { error: 'Failed to create note.' }
  }
}

export async function updateGeneralNote(rawData: unknown): Promise<ActionResult> {
  const authResult = await getCurrentUserAndTeam()
  if ('error' in authResult) {
    return { error: authResult.error }
  }
  
  const { user, teamId } = authResult

  const validatedFields = updateNoteSchema.safeParse(rawData)
  if (!validatedFields.success) {
    return { error: 'Invalid data for updating note.' }
  }

  const { id, title, content, isPrivate } = validatedFields.data

  try {
    // Check if the note exists and belongs to the user
    const [existingNote] = await db
      .select({ authorId: teacherComments.authorId, teamId: teacherComments.teamId })
      .from(teacherComments)
      .where(
        and(
          eq(teacherComments.id, id),
          eq(teacherComments.commentType, 'general')
        )
      )

    if (!existingNote) {
      return { error: 'Note not found.' }
    }

    if (existingNote.authorId !== user.id) {
      return { error: 'Not authorized to edit this note.' }
    }

    if (existingNote.teamId !== teamId) {
      return { error: 'Note does not belong to your team.' }
    }

    await db
      .update(teacherComments)
      .set({
        title,
        content,
        isPrivate,
        updatedAt: new Date(),
      })
      .where(eq(teacherComments.id, id))

    revalidatePath('/dashboard/notes')
    return { success: true, message: 'Note updated successfully' }

  } catch (error) {
    console.error('Error updating note:', error)
    return { error: 'Failed to update note.' }
  }
}

export async function deleteGeneralNote(rawData: unknown): Promise<ActionResult> {
  const authResult = await getCurrentUserAndTeam()
  if ('error' in authResult) {
    return { error: authResult.error }
  }
  
  const { user, teamId } = authResult

  const validatedFields = deleteNoteSchema.safeParse(rawData)
  if (!validatedFields.success) {
    return { error: 'Invalid data for deleting note.' }
  }

  const { id } = validatedFields.data

  try {
    // Check if the note exists and belongs to the user
    const [existingNote] = await db
      .select({ authorId: teacherComments.authorId, teamId: teacherComments.teamId })
      .from(teacherComments)
      .where(
        and(
          eq(teacherComments.id, id),
          eq(teacherComments.commentType, 'general')
        )
      )

    if (!existingNote) {
      return { error: 'Note not found.' }
    }

    if (existingNote.authorId !== user.id) {
      return { error: 'Not authorized to delete this note.' }
    }

    if (existingNote.teamId !== teamId) {
      return { error: 'Note does not belong to your team.' }
    }

    await db
      .delete(teacherComments)
      .where(eq(teacherComments.id, id))

    revalidatePath('/dashboard/notes')
    return { success: true, message: 'Note deleted successfully' }

  } catch (error) {
    console.error('Error deleting note:', error)
    return { error: 'Failed to delete note.' }
  }
}

// --- Query Functions ---

export async function getUserGeneralNotes() {
  const authResult = await getCurrentUserAndTeam()
  if ('error' in authResult) {
    throw new Error(authResult.error)
  }
  
  const { user, teamId } = authResult

  try {
    const notes = await db
      .select({
        id: teacherComments.id,
        title: teacherComments.title,
        content: teacherComments.content,
        isPrivate: teacherComments.isPrivate,
        createdAt: teacherComments.createdAt,
        updatedAt: teacherComments.updatedAt,
      })
      .from(teacherComments)
      .where(
        and(
          eq(teacherComments.authorId, user.id),
          eq(teacherComments.teamId, teamId),
          eq(teacherComments.commentType, 'general')
        )
      )
      .orderBy(desc(teacherComments.updatedAt))

    return notes

  } catch (error) {
    console.error('Error fetching user notes:', error)
    throw new Error('Failed to fetch notes')
  }
}

// --- Student Comments Functions ---

export async function getStudentComments(studentId: string, classId: string) {
  const authResult = await getCurrentUserAndTeam()
  if ('error' in authResult) {
    throw new Error(authResult.error)
  }
  
  const { user, teamId } = authResult

  try {
    const comments = await db
      .select({
        id: teacherComments.id,
        title: teacherComments.title,
        content: teacherComments.content,
        createdAt: teacherComments.createdAt,
        updatedAt: teacherComments.updatedAt,
      })
      .from(teacherComments)
      .where(
        and(
          eq(teacherComments.teamId, teamId),
          eq(teacherComments.commentType, 'student'),
          eq(teacherComments.studentId, studentId),
          eq(teacherComments.classId, classId)
        )
      )
      .orderBy(desc(teacherComments.updatedAt))

    return comments

  } catch (error) {
    console.error('Error fetching student comments:', error)
    throw new Error('Failed to fetch student comments')
  }
}

export async function createStudentComment(rawData: { 
  studentId: string, 
  classId: string, 
  title: string, 
  content: string 
}): Promise<ActionResult> {
  const authResult = await getCurrentUserAndTeam()
  if ('error' in authResult) {
    return { error: authResult.error }
  }
  
  const { user, teamId } = authResult

  const { studentId, classId, title, content } = rawData

  if (!studentId || !classId || !title || !content) {
    return { error: 'Missing required fields for student comment.' }
  }

  try {
    await db.insert(teacherComments).values({
      teamId,
      authorId: user.id,
      commentType: 'student',
      studentId,
      classId,
      title,
      content,
      isPrivate: true, // Student comments are always private to the teacher
    })

    revalidatePath(`/dashboard/students/${studentId}`)
    return { success: true, message: 'Student comment created successfully' }

  } catch (error) {
    console.error('Error creating student comment:', error)
    return { error: 'Failed to create student comment.' }
  }
} 