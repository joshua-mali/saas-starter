'use server'

import { db } from '@/lib/db/drizzle';
import { gradeScales, NewTerm, nswTermDates, teamMembers, terms } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Zod schema for date validation (YYYY-MM-DD)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");

// Type for the action state
type ActionState = {
  error?: string | null;
  success?: boolean;
};

export async function saveTermDates(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'User not authenticated', success: false };
  }

  // Get user's team ID
  const [userTeam] = await db.select({ teamId: teamMembers.teamId })
                         .from(teamMembers)
                         .where(eq(teamMembers.userId, user.id))
                         .limit(1);

  if (!userTeam || typeof userTeam.teamId !== 'number') {
    return { error: 'User team not found', success: false };
  }
  const teamId = userTeam.teamId;

  // --- Parse and Validate Form Data ---
  const calendarYearStr = formData.get('calendarYear');
  const calendarYear = parseInt(calendarYearStr as string, 10);

  if (isNaN(calendarYear) || calendarYear < 2000 || calendarYear > 2100) {
      return { error: 'Invalid calendar year provided.', success: false };
  }

  const termsToUpsert: NewTerm[] = [];
  const validationErrors: string[] = [];

  for (let i = 1; i <= 4; i++) {
    const startDateStr = formData.get(`term${i}_start`) as string;
    const endDateStr = formData.get(`term${i}_end`) as string;

    const startResult = dateSchema.safeParse(startDateStr);
    const endResult = dateSchema.safeParse(endDateStr);

    if (!startResult.success) {
        validationErrors.push(`Term ${i} Start Date: ${startResult.error.issues.map(iss => iss.message).join(', ')}`);
    }
    if (!endResult.success) {
        validationErrors.push(`Term ${i} End Date: ${endResult.error.issues.map(iss => iss.message).join(', ')}`);
    }
    
    if (startResult.success && endResult.success) {
        const startDate = new Date(startResult.data + 'T00:00:00Z'); // Assume start of day UTC
        const endDate = new Date(endResult.data + 'T00:00:00Z');   // Assume start of day UTC

        if (endDate < startDate) {
            validationErrors.push(`Term ${i}: End date cannot be before start date.`);
        }

        termsToUpsert.push({
            teamId: teamId,
            calendarYear: calendarYear,
            termNumber: i,
            startDate: startDate,
            endDate: endDate,
            // createdAt/updatedAt will be handled by database default/triggers
        });
    }
  }

  if (validationErrors.length > 0) {
      return { error: validationErrors.join('\n'), success: false };
  }

  if (termsToUpsert.length !== 4) {
       return { error: 'Failed to parse dates for all 4 terms.', success: false };
  }

  // --- Database Operation --- 
  try {
    // Use transaction for atomicity (upserting multiple rows)
    await db.transaction(async (tx) => {
        for (const termData of termsToUpsert) {
            await tx.insert(terms)
                    .values(termData)
                    .onConflictDoUpdate({
                        target: [terms.teamId, terms.calendarYear, terms.termNumber],
                        set: { 
                            startDate: termData.startDate,
                            endDate: termData.endDate,
                            updatedAt: new Date() // Manually set updatedAt on update
                         } 
                    });
        }
    });

    // Revalidate the path where settings are displayed
    revalidatePath('/dashboard/settings'); // Adjust if path is different
    return { success: true, error: null };

  } catch (error) {
    console.error("Error saving term dates:", error);
    return { error: 'Database error occurred while saving term dates.', success: false };
  }
}

// --- UPDATED: Update Grade Scales Action (now class-specific) ---
export async function updateGradeScales(prevState: ActionState, formData: FormData): Promise<ActionState> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Basic auth check (consider role-based access if needed later)
    if (authError || !user) {
        return { error: 'User not authenticated', success: false };
    }

    // Get classId from form data
    const classId = formData.get('classId') as string;
    if (!classId) {
        return { error: 'Class ID is required for updating grade scales', success: false };
    }

    const updates: { id: number; name: string; description: string | null }[] = [];
    const validationErrors: string[] = [];
    const submittedIds = new Set<number>();

    // 1. Parse FormData
    const scaleDataById: Record<number, { name?: string; description?: string | null }> = {};
    for (const [key, value] of formData.entries()) {
        if (key.startsWith('id_')) {
            const id = parseInt(value as string, 10);
            if (!isNaN(id)) submittedIds.add(id);
        } else if (key.startsWith('name_')) {
            const id = parseInt(key.split('_')[1], 10);
            if (!isNaN(id)) {
                if (!scaleDataById[id]) scaleDataById[id] = {};
                scaleDataById[id].name = value as string;
            }
        } else if (key.startsWith('description_')) {
            const id = parseInt(key.split('_')[1], 10);
            if (!isNaN(id)) {
                if (!scaleDataById[id]) scaleDataById[id] = {};
                scaleDataById[id].description = (value as string) || null; 
            }
        }
    }

    // 2. Validate and Prepare Updates
    for (const id of submittedIds) {
        const data = scaleDataById[id];
        if (!data || typeof data.name !== 'string' || data.name.trim() === '') {
            validationErrors.push(`Missing or empty name for scale ID ${id}.`);
            continue;
        }
        updates.push({
            id: id,
            name: data.name.trim(),
            description: data.description ?? null,
        });
    }

    if (validationErrors.length > 0) {
        return { error: validationErrors.join('\n'), success: false };
    }

    if (updates.length === 0) {
        return { error: 'No valid grade scale data submitted for update.', success: false };
    }

    // 3. Database Operation - Verify grade scales belong to the class
    try {
        await db.transaction(async (tx) => {
            for (const update of updates) {
                // Verify the grade scale belongs to the specified class
                const [existingScale] = await tx.select({ classId: gradeScales.classId })
                                                .from(gradeScales)
                                                .where(eq(gradeScales.id, update.id))
                                                .limit(1);

                if (!existingScale || existingScale.classId !== classId) {
                    throw new Error(`Grade scale ${update.id} does not belong to class ${classId}`);
                }

                await tx.update(gradeScales)
                        .set({
                            name: update.name,
                            description: update.description,
                            updatedAt: new Date(),
                        })
                        .where(eq(gradeScales.id, update.id));
            }
        });

        revalidatePath('/dashboard/settings'); // Revalidate the settings page
        revalidatePath('/dashboard/classes'); // Revalidate classes page where grade scales might be displayed

        return { success: true, error: null };

    } catch (dbError) {
        console.error("Error updating grade scales:", dbError);
        return { error: 'Database error occurred while updating grade scales.', success: false };
    }
}

// --- NEW: Load NSW Term Dates Action ---
export async function loadNSWTermDates(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'User not authenticated', success: false };
  }

  // Get user's team ID
  const [userTeam] = await db.select({ teamId: teamMembers.teamId })
                         .from(teamMembers)
                         .where(eq(teamMembers.userId, user.id))
                         .limit(1);

  if (!userTeam || typeof userTeam.teamId !== 'number') {
    return { error: 'User team not found', success: false };
  }
  const teamId = userTeam.teamId;

  // Parse form data
  const calendarYearStr = formData.get('calendarYear');
  const division = formData.get('division') as string;

  const calendarYear = parseInt(calendarYearStr as string, 10);

  if (isNaN(calendarYear) || calendarYear < 2000 || calendarYear > 2100) {
    return { error: 'Invalid calendar year provided.', success: false };
  }

  if (!division || !['Eastern', 'Western'].includes(division)) {
    return { error: 'Invalid division. Must be Eastern or Western.', success: false };
  }

  try {
    // Get NSW term dates for the specified year and division
    const nswDates = await db.select()
      .from(nswTermDates)
      .where(and(
        eq(nswTermDates.calendarYear, calendarYear),
        eq(nswTermDates.division, division)
      ))
      .orderBy(asc(nswTermDates.termNumber));

    if (nswDates.length === 0) {
      return { error: `No NSW term dates found for ${calendarYear} (${division} division).`, success: false };
    }

    // Convert NSW dates to terms format and upsert
    await db.transaction(async (tx) => {
      for (const nswDate of nswDates) {
        await tx.insert(terms)
          .values({
            teamId: teamId,
            calendarYear: calendarYear,
            termNumber: nswDate.termNumber,
            startDate: new Date(nswDate.startDate),
            endDate: new Date(nswDate.endDate),
          })
          .onConflictDoUpdate({
            target: [terms.teamId, terms.calendarYear, terms.termNumber],
            set: { 
              startDate: new Date(nswDate.startDate),
              endDate: new Date(nswDate.endDate),
              updatedAt: new Date()
            } 
          });
      }
    });

    revalidatePath('/dashboard/settings');
    return { success: true, error: null };

  } catch (error) {
    console.error("Error loading NSW term dates:", error);
    return { error: 'Database error occurred while loading NSW term dates.', success: false };
  }
} 