'use server'

import { db } from '@/lib/db/drizzle'
import { classCurriculumPlan, type ClassCurriculumPlanItem } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// --- Helper: Check Authorization --- 
// Placeholder - implement proper check to ensure user teaches the class
async function canUserModifyClassPlan(userId: string, classId: number): Promise<boolean> {
  // TODO: Query classTeachers table to see if userId is linked to classId
  console.warn(`Authorization check skipped for user ${userId} and class ${classId}`);
  return true; 
}

// --- Action Schemas --- 

const addPlanItemSchema = z.object({
  classId: z.coerce.number().int().positive(),
  contentGroupId: z.coerce.number().int().positive(),
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Week start date must be in YYYY-MM-DD format" }),
  durationWeeks: z.coerce.number().int().min(1).optional().default(1),
})

const updatePlanItemSchema = z.object({
  planItemId: z.coerce.number().int().positive(),
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Week start date must be in YYYY-MM-DD format" }),
  durationWeeks: z.coerce.number().int().min(1).optional(), // Optional for update
})

const deletePlanItemSchema = z.object({
    planItemId: z.coerce.number().int().positive(),
})

// --- Action Result Type --- 
export interface ActionResult {
  error?: string | null
  success?: boolean
  newItem?: ClassCurriculumPlanItem | null
}

// --- Server Actions --- 

export async function addPlanItem(
  rawData: unknown // Expecting data matching addPlanItemSchema
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'User not authenticated' }

  const validatedFields = addPlanItemSchema.safeParse(rawData)
  if (!validatedFields.success) {
    return { error: 'Invalid data for adding plan item.' }
  }

  const { classId, contentGroupId, weekStartDate, durationWeeks } = validatedFields.data

  // Authorization check
  const authorized = await canUserModifyClassPlan(user.id, classId);
  if (!authorized) return { error: 'User not authorized to modify this class plan.' };

  try {
    // Convert the YYYY-MM-DD string to a Date object, treating it as UTC
    const dateObject = new Date(weekStartDate + 'T00:00:00Z');

    const [newItem] = await db.insert(classCurriculumPlan)
                            .values({
                              classId,
                              contentGroupId,
                              weekStartDate: dateObject, // Use the new Date object
                              durationWeeks,
                            })
                            .returning();

    revalidatePath('/dashboard/planning')
    return { success: true, error: null, newItem: newItem }

  } catch (error) {
    console.error('Error adding plan item:', error)
    return { error: 'Failed to add item to plan.' }
  }
}

export async function updatePlanItem(
  rawData: unknown // Expecting data matching updatePlanItemSchema
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'User not authenticated' }

  const validatedFields = updatePlanItemSchema.safeParse(rawData)
  if (!validatedFields.success) {
    return { error: 'Invalid data for updating plan item.' }
  }

  const { planItemId, weekStartDate, durationWeeks } = validatedFields.data

  // Fetch original item to check ownership/classId for auth
  const [originalItem] = await db.select({ classId: classCurriculumPlan.classId })
                                .from(classCurriculumPlan)
                                .where(eq(classCurriculumPlan.id, planItemId));

  if (!originalItem) return { error: 'Plan item not found.' };

  // Authorization check
  const authorized = await canUserModifyClassPlan(user.id, originalItem.classId);
  if (!authorized) return { error: 'User not authorized to modify this item.' };

  try {
    // Convert the YYYY-MM-DD string to a Date object, treating it as UTC
    const dateObject = new Date(weekStartDate + 'T00:00:00Z');

    await db.update(classCurriculumPlan)
            .set({
              weekStartDate: dateObject, // Use the new Date object
              // Only update duration if provided
              ...(durationWeeks !== undefined && { durationWeeks }),
              updatedAt: new Date(),
            })
            .where(eq(classCurriculumPlan.id, planItemId));

    revalidatePath('/dashboard/planning')
    return { success: true, error: null }

  } catch (error) {
    console.error('Error updating plan item:', error)
    return { error: 'Failed to update plan item.' }
  }
}

export async function deletePlanItem(
    rawData: unknown // Expecting data matching deletePlanItemSchema
): Promise<ActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'User not authenticated' };

    const validatedFields = deletePlanItemSchema.safeParse(rawData);
    if (!validatedFields.success) {
        return { error: 'Invalid data for deleting plan item.' };
    }

    const { planItemId } = validatedFields.data;

    // Fetch original item to check ownership/classId for auth
    const [originalItem] = await db.select({ classId: classCurriculumPlan.classId })
                                  .from(classCurriculumPlan)
                                  .where(eq(classCurriculumPlan.id, planItemId));

    if (!originalItem) return { error: 'Plan item not found.' }; // Or maybe succeed if already gone?

    // Authorization check
    const authorized = await canUserModifyClassPlan(user.id, originalItem.classId);
    if (!authorized) return { error: 'User not authorized to delete this item.' };

    try {
        await db.delete(classCurriculumPlan).where(eq(classCurriculumPlan.id, planItemId));

        revalidatePath('/dashboard/planning')
        return { success: true, error: null };

    } catch (error) {
        console.error('Error deleting plan item:', error);
        return { error: 'Failed to delete plan item.' };
    }
} 