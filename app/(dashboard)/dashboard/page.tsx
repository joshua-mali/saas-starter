import { db } from '@/lib/db/drizzle';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { TeamSettings } from './team-settings';
// Import tables needed for creation + types
import {
  NewTeam,
  NewTeamMember, // Use base TeamMember type
  profiles, // Import profiles table
  teamMembers,
  teams,
} from '@/lib/db/schema';
// Import getMemberLimit helper
import { getMemberLimit } from '@/lib/plans';
// Import logActivity types if needed
// import { logActivity, ActivityType } from '@/app/(login)/actions';

export default async function DashboardPage() {
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

  // Fetch ONLY team data and members
  const [team, membersWithProfiles] = await Promise.all([
    db.query.teams.findFirst({ where: eq(teams.id, teamIdToLoad) }),
    db.select({
        memberId: teamMembers.id,
        userId: teamMembers.userId,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        profileId: profiles.id,
        fullName: profiles.full_name,
        email: profiles.email
    })
    .from(teamMembers)
    .leftJoin(profiles, eq(teamMembers.userId, profiles.id))
    .where(eq(teamMembers.teamId, teamIdToLoad)),
  ]);

  if (!team) {
    throw new Error(`Team not found for ID: ${teamIdToLoad}`);
  }

  // Calculate member limit
  const memberLimit = getMemberLimit(team.planName);

  // Adapt data structure
  const adaptedTeamData = {
    ...team, // Spread basic team info
    memberLimit, // Add the calculated limit
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

  // Render the TeamSettings component
  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Team & Subscription</h1>
      <TeamSettings 
        teamData={adaptedTeamData as any} 
        currentMemberCount={adaptedTeamData.teamMembers.length}
        memberLimit={adaptedTeamData.memberLimit}
      />
    </div>
  );
}
