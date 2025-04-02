import { db } from '@/lib/db/drizzle';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Settings } from './settings';
// Import tables needed for creation + types
import {
  NewTeam,
  NewTeamMember,
  TeamMember, // Import Team type
  teamMembers,
  teams
} from '@/lib/db/schema';
// Import logActivity types if needed
// import { logActivity, ActivityType } from '@/app/(login)/actions';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/sign-in');
  }

  let teamIdToLoad: number | null = null;

  // Try fetching existing membership
  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id))
    .limit(1);

  // If no membership found, attempt to create default team and membership
  if (!membership?.teamId) {
    console.log(`No team membership found for user ${user.id}. Attempting to create default team...`);
    try {
      const newTeamData: NewTeam = {
        name: `${user.email}'s Team`,
      };
      const [createdTeam] = await db.insert(teams).values(newTeamData).returning({ id: teams.id });

      if (!createdTeam?.id) {
        throw new Error("Failed to create default team during insert.");
      }

      teamIdToLoad = createdTeam.id;

      const newMemberData: NewTeamMember = {
        userId: user.id,
        teamId: teamIdToLoad,
        role: 'owner',
      };
      await db.insert(teamMembers).values(newMemberData);

      console.log(`Default team ${teamIdToLoad} created for user ${user.id}.`);

      // TODO: Log activity

    } catch (creationError) {
      console.error(`Failed to create default team/membership for user ${user.id}:`, creationError);
      throw new Error('Failed to set up your team. Please contact support.');
    }
  } else {
    teamIdToLoad = membership.teamId;
  }

  if (!teamIdToLoad) {
     throw new Error('Could not determine team ID for user.');
  }

  // Fetch team data, SIMPLIFYING relations further for debugging
  const teamData = await db.query.teams.findFirst({
    where: eq(teams.id, teamIdToLoad),
    with: {
      teamMembers: {
        // Only fetch teamMember columns, DO NOT fetch related user/profile for now
        columns: {
          id: true,
          userId: true,
          teamId: true,
          role: true,
          joinedAt: true
        },
        // REMOVED this section for debugging:
        // with: {
        //   user: { // Relation to authUsers
        //     columns: { id: true },
        //     // Temporarily comment out nested profile relation for debugging
        //     // with: {
        //     //   profile: true
        //     // }
        //   }
        // },
      },
    },
  });

  if (!teamData) {
    throw new Error(`Team not found for ID: ${teamIdToLoad}`);
  }

  // Adapt data structure - user info will be minimal
  const adaptedTeamData = {
    ...teamData,
    teamMembers: (teamData.teamMembers || []).map((member: TeamMember) => { // Use base TeamMember type
      return {
        ...member,
        user: { // Construct minimal user object
          id: member.userId,
          name: null, // No name fetched
          email: null // No email fetched
        }
      };
    })
  };

  return <Settings teamData={adaptedTeamData} />;
}
