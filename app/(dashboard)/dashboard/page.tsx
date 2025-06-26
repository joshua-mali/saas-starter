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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getMemberLimit } from '@/lib/plans';
import { MessageSquare, Plus, StickyNote } from 'lucide-react';
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
       // IMPORTANT: Fetch user's profile needed for default team name
      const [userProfile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
      if (!userProfile) {
          // This case should ideally not happen if the trigger works, but handle defensively
          console.warn(`Profile not found for user ${user.id} when creating default team. Using email for name.`);
          // Optionally throw an error or proceed with a placeholder name
      }

      const newTeamData: NewTeam = {
        name: `${userProfile?.full_name || user.email}'s Team`,
        // --- Set Free Tier Defaults (camelCase) ---
        planName: 'Free',
        subscriptionStatus: 'free',
        teacherLimit: 1, // Set free tier limit
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripeProductId: null,
        // --- End Free Tier Defaults ---
      };
      const [createdTeam] = await db.insert(teams).values(newTeamData).returning({ id: teams.id });

      if (!createdTeam?.id) {
        throw new Error("Failed to create default team during insert.");
      }

      teamIdToLoad = createdTeam.id;

      // No need to fetch profile again here

      const newMemberData: NewTeamMember = {
        userId: user.id,
        teamId: teamIdToLoad,
        role: 'owner',
      };
      await db.insert(teamMembers).values(newMemberData);

      console.log(`Default team ${teamIdToLoad} (Free Plan) created for user ${user.id}.`);

      // TODO: Log activity (Team Created - Free Plan)

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

  // Render the new layout
  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Welcome back, {user.user_metadata.full_name}!</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side - Quick Actions */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          
          {/* General Notes Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StickyNote className="h-5 w-5 text-yellow-600" />
                General Notes
              </CardTitle>
              <CardDescription>
                Add quick notes and reminders for yourself
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Create personal notes that only you can see. Perfect for lesson ideas, reminders, or general thoughts.
                </p>
                <Button className="w-full" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add General Note
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Student Comments Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                Student Comments
              </CardTitle>
              <CardDescription>
                Add comments about specific students (separate from grades)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Record behavioral observations, parent meeting notes, or general comments about students that are unrelated to their academic grades.
                </p>
                <Button className="w-full" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Student Comment
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Placeholder Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-gray-400" />
                Coming Soon
              </CardTitle>
              <CardDescription>
                More quick actions will be available here
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  We're working on additional features to make your teaching workflow even more efficient.
                </p>
                <Button className="w-full" variant="outline" disabled>
                  Feature Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Team Settings */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Team Management</h2>
          <TeamSettings 
            teamData={adaptedTeamData as any} 
            currentMemberCount={adaptedTeamData.teamMembers.length}
            memberLimit={adaptedTeamData.memberLimit}
          />
        </div>
      </div>
    </div>
  );
}
