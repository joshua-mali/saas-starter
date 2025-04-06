'use server'

import { db } from '@/lib/db/drizzle'
import { teamMembers, terms } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Schema for a single term's dates
const termDateSchema = z.object({
  termNumber: z.coerce.number().int().min(1).max(4),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
})

// Schema for the overall form data
const saveTermDatesSchema = z.object({
  calendarYear: z.coerce.number().int().min(2000).max(2100),
  terms: z.array(termDateSchema).length(4, 'Exactly 4 term dates are required'),
})

interface ActionResult {
  error?: string | null
  success?: boolean
}

export async function saveTermDates(
  prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'User not authenticated' }
  }

  // Get user's team ID
  const [userTeam] = await db.select({ teamId: teamMembers.teamId })
                         .from(teamMembers)
                         .where(eq(teamMembers.userId, user.id))
                         .limit(1);

  if (!userTeam || typeof userTeam.teamId !== 'number') {
    return { error: 'User is not associated with a team.' }
  }
  const teamId = userTeam.teamId;

  // Extract and structure term data from FormData
  const rawData = {
    calendarYear: formData.get('calendarYear'),
    terms: [
      { termNumber: 1, startDate: formData.get('term1_start'), endDate: formData.get('term1_end') },
      { termNumber: 2, startDate: formData.get('term2_start'), endDate: formData.get('term2_end') },
      { termNumber: 3, startDate: formData.get('term3_start'), endDate: formData.get('term3_end') },
      { termNumber: 4, startDate: formData.get('term4_start'), endDate: formData.get('term4_end') },
    ]
  };

  // Validate the structured data
  const validatedFields = saveTermDatesSchema.safeParse(rawData)

  if (!validatedFields.success) {
    console.error("Term date validation failed:", validatedFields.error.flatten());
    // Basic error for now, could be more specific
    return { error: 'Invalid term date data. Please ensure all dates are valid.' }
  }

  const { calendarYear, terms: termData } = validatedFields.data

  // Prepare data for insertion/update
  const valuesToUpsert = termData.map(term => ({
    teamId: teamId,
    calendarYear: calendarYear,
    termNumber: term.termNumber,
    startDate: term.startDate,
    endDate: term.endDate,
  }))

  try {
    // Perform the upsert operation
    await db.insert(terms)
            .values(valuesToUpsert)
            .onConflictDoUpdate({
              target: [terms.teamId, terms.calendarYear, terms.termNumber],
              set: {
                startDate: sql`excluded.start_date`,
                endDate: sql`excluded.end_date`,
                updatedAt: new Date(),
              }
            });

    console.log(`Term dates saved successfully for team ${teamId}, year ${calendarYear}`);
    revalidatePath('/dashboard/terms')
    revalidatePath('/dashboard/planning')
    return { success: true, error: null }

  } catch (error) {
    console.error(`Error saving term dates for team ${teamId}, year ${calendarYear}:`, error)
    return { error: 'An unexpected error occurred while saving term dates.' }
  }
} 