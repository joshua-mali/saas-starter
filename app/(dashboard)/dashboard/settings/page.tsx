import { db } from '@/lib/db/drizzle';
import { teamMembers, terms, type Term } from '@/lib/db/schema'; // Import necessary schema items
import { createClient } from '@/lib/supabase/server';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Settings } from '../settings'; // Import the UI component (relative path needed)

// Function to fetch term dates (copied from original page.tsx)
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

export default async function SettingsPage() { 
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/sign-in');
  }

  // Get user's team ID (same logic as before)
  const [userTeam] = await db.select({ teamId: teamMembers.teamId })
                         .from(teamMembers)
                         .where(eq(teamMembers.userId, user.id))
                         .limit(1);

  if (!userTeam || typeof userTeam.teamId !== 'number') {
    throw new Error('User is not associated with a team.');
  }
  const teamId = userTeam.teamId;

  // Determine current year and fetch terms
  const currentYear = new Date().getFullYear();
  const existingTerms = await getTermDatesForYear(teamId, currentYear);

  // Render the Settings UI component, passing only term data
  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Settings</h1>
      <Settings 
        initialTerms={existingTerms} 
        calendarYear={currentYear} 
      />
    </div>
  );
} 