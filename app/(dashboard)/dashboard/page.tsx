import { db } from '@/lib/db/drizzle';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Settings } from './settings';
// Import tables needed for creation + types
import {
  NewTeam,
  NewTeamMember, // Use base TeamMember type
  profiles, // Import profiles table
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
        name: `${user.email}'s Team`, // Default team name
      };
      const [createdTeam] = await db.insert(teams).values(newTeamData).returning({ id: teams.id });

      if (!createdTeam?.id) {
        throw new Error("Failed to create default team during insert.");
      }

      teamIdToLoad = createdTeam.id;

      // IMPORTANT: Fetch user's profile after potential creation by trigger
      const [userProfile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
      if (!userProfile) {
          console.warn(`Profile not found for user ${user.id} immediately after sign-up/team creation. This might indicate a delay or issue with the handle_new_user trigger.`);
          // Handle appropriately - perhaps retry or show a placeholder? For now, log warning.
      }

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

  // Fetch team data using explicit joins
  const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamIdToLoad)
  });

  if (!team) {
    throw new Error(`Team not found for ID: ${teamIdToLoad}`);
  }

  // Fetch members separately with an explicit join to profiles
  const membersWithProfiles = await db
      .select({
          memberId: teamMembers.id,
          userId: teamMembers.userId,
          role: teamMembers.role,
          joinedAt: teamMembers.joinedAt,
          profileId: profiles.id,
          fullName: profiles.full_name,
          email: profiles.email
      })
      .from(teamMembers)
      .leftJoin(profiles, eq(teamMembers.userId, profiles.id)) // Join on user ID
      .where(eq(teamMembers.teamId, teamIdToLoad));

  // Adapt data structure
  const adaptedTeamData = {
    ...team, // Spread basic team info
    teamMembers: membersWithProfiles.map((member) => ({
      id: member.memberId,
      userId: member.userId,
      teamId: teamIdToLoad, // Already known
      role: member.role,
      joinedAt: member.joinedAt,
      // Construct nested user object expected by Settings component
      user: {
        id: member.userId,
        name: member.fullName ?? 'Unknown User',
        email: member.email ?? 'No Email',
      }
    }))
  };

  // Type assertion for Settings component props if needed
  // Assuming Settings expects { teamData: { ..., teamMembers: [{ ..., user: { id: string, name: string, email: string } }] } }

  return <Settings teamData={adaptedTeamData as any} />; // Use 'as any' temporarily if types mismatch
}
