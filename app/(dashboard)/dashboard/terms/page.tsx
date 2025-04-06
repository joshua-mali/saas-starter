import { db } from '@/lib/db/drizzle';
import { teamMembers, terms, type Term } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import TermDatesClient from './client';

// Fetch existing term dates for a specific team and year
async function getTermDatesForYear(teamId: number, calendarYear: number): Promise<Term[]> {
  const termData = await db.select()
                         .from(terms)
                         .where(and(
                           eq(terms.teamId, teamId),
                           eq(terms.calendarYear, calendarYear)
                         ))
                         .orderBy(terms.termNumber);
  return termData;
}

export default async function TermDatesPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/sign-in');
  }

  // Get user's team ID
  const [userTeam] = await db.select({ teamId: teamMembers.teamId })
                         .from(teamMembers)
                         .where(eq(teamMembers.userId, user.id))
                         .limit(1);

  if (!userTeam || typeof userTeam.teamId !== 'number') {
    // Maybe redirect to a page explaining they need to be in a team?
    // Or handle default team creation if applicable
    throw new Error('User is not associated with a team.');
  }
  const teamId = userTeam.teamId;

  // Determine the current calendar year
  const currentYear = new Date().getFullYear();

  // Fetch existing terms for the current year and team
  const existingTerms = await getTermDatesForYear(teamId, currentYear);

  return (
    <TermDatesClient
      teamId={teamId}
      calendarYear={currentYear}
      initialTerms={existingTerms}
    />
  );
} 