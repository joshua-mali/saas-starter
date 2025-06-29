'use server';

import {
    validatedAction
} from '@/lib/auth/middleware';
import { db } from '@/lib/db/drizzle';
import {
    activityLogs,
    ActivityType,
    invitations,
    profiles,
    teamMembers,
    teams,
    type NewActivityLog,
    type NewTeamMember,
    type TeamMember
} from '@/lib/db/schema';
import { getMemberLimit } from '@/lib/plans';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { AuthApiError, PostgrestError } from '@supabase/supabase-js';
import { and, count, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';

// Add success field to ActionResult
interface ActionResult {
  error?: string | null;
  fieldErrors?: Record<string, string[]> | null; // Keep fieldErrors if used elsewhere
  success?: boolean; // Add success flag
  message?: string; // Add message field for success messages
}

async function logActivity(
  teamId: number | null | undefined,
  userId: string,
  type: ActivityType,
  ipAddress?: string,
) {
  if (teamId === null || teamId === undefined) {
    return;
  }
  const newActivity: NewActivityLog = {
    teamId,
    userId,
    action: type,
    ipAddress: ipAddress || '',
  };
  await db.insert(activityLogs).values(newActivity);
}

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100),
});

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Log the error for debugging
    console.error("Supabase sign in error:", error);
    // Provide a generic error message to the user
    return {
      error: 'Invalid email or password. Please try again.',
      email, // Keep email in state for the form
      password: '', // Clear password field
    };
  }

  // Remove custom session setting and activity logging for now
  // const userWithTeam = await db... // No need to query user/team here
  // await Promise.all([
  //   setSession(foundUser), // Supabase handles sessions via cookies
  //   logActivity(foundTeam?.id, foundUser.id, ActivityType.SIGN_IN), // Decide if/how to log activity with Supabase user ID
  // ]);

  const redirectTo = formData.get('redirect') as string | null;
  // TODO: Re-evaluate checkout flow. We need the team context after Supabase sign-in.
  // For now, redirect directly to dashboard.
  // if (redirectTo === 'checkout') {
  //   const priceId = formData.get('priceId') as string;
  //   const { data: { user } } = await supabase.auth.getUser();
  //   // Need to fetch team associated with the Supabase user ID here
  //   // const team = await getTeamForUser(user.id); // This assumes getTeamForUser works with Supabase user ID
  //   // return createCheckoutSession({ team: team, priceId });
  // }

  // Redirect to dashboard after successful Supabase sign-in
  redirect('/dashboard');
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1, "Full name is required"),
  inviteToken: z.string().optional(),
  teamId: z.string().optional(),
  role: z.string().optional(),
});

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password, fullName, inviteToken, teamId, role } = data;
  console.log('signUp action called with:', { email, fullName, inviteToken, teamId, role });

  // === Add User Existence Check using RPC ===
  try {
    const { data: existingUserData, error: rpcError } = await supabaseAdmin.rpc(
      'get_user_id_by_email', 
      { user_email: email } // Pass email to the function
    );

    // Handle potential RPC errors
    if (rpcError) {
        // Differentiate between expected "not found" (empty result) and actual errors
        // A PostgrestError with code P0001 might indicate function not found, 
        // or other codes for SQL errors. Empty data isn't an error itself here.
        console.error('RPC get_user_id_by_email error:', rpcError);
        throw rpcError; // Throw actual errors
    }

    // Check if the function returned any rows (meaning user exists)
    // The function returns an array of objects like [{ id: 'uuid' }] or []
    if (existingUserData && existingUserData.length > 0) {
        console.log(`Sign up attempt for existing email: ${email}`);
        return { error: 'An account with this email already exists. Please sign in.' };
    }
    
    // If RPC succeeded and returned no data, the email is not in use. Proceed.

  } catch (error) {
    console.error('Error during RPC user existence check:', error);
    let errorMessage = 'Could not verify email address. Please try again later.';
     if (error instanceof PostgrestError) {
        errorMessage = `Database Error (${error.code}): ${error.message}`;
    } else if (error instanceof AuthApiError) {
        errorMessage = `Auth Error: ${error.message}`;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { error: errorMessage };
  }
  // === End User Existence Check ===

  // Proceed with signup if user does not exist
  const supabase = await createClient();

  const { error: signUpError, data: { user } } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (signUpError) {
    console.error('Supabase sign up error:', signUpError.message);
    return { error: `Could not authenticate user: ${signUpError.message}` };
  }

  if (!user) {
    // This case indicates email confirmation is required
    return { 
      success: true,
      message: 'Account created successfully! Please check your email and click the confirmation link before signing in.' 
    }; 
  }

  console.log('Sign up successful for:', user.email, 'User ID:', user.id);

  // Check if email confirmation is required (user exists but email not confirmed)
  if (user && !user.email_confirmed_at) {
    console.log('User created but email confirmation required');
    return { 
      success: true,
      message: 'Account created successfully! Please check your email and click the confirmation link before signing in.' 
    };
  }

  // --- Invite Processing Logic --- 
  if (inviteToken && teamId && role) {
    console.log(`Processing invite for user ${user.id} to team ${teamId} with role ${role}. Token: ${inviteToken}`);

    try {
      // 1. Add user to the target team
      const teamIdNum = parseInt(teamId, 10);
      if (isNaN(teamIdNum)) {
        throw new Error(`Invalid teamId received: ${teamId}`);
      }

      // --- Check Team Member Limit BEFORE Adding Member ---
      try {
        const [teamData] = await db.select({ 
          planName: teams.planName, 
          memberCount: count(teamMembers.id) 
        })
        .from(teams)
        .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
        .where(eq(teams.id, teamIdNum))
        .groupBy(teams.id);

        if (!teamData) {
          console.error(`Sign Up: Team not found (ID: ${teamIdNum}) during invite processing.`);
          return { error: 'Invited team not found.' };
        }

        const limit = getMemberLimit(teamData.planName);
        if (teamData.memberCount >= limit) {
          console.warn(`Sign Up: Team ${teamIdNum} is full (Limit: ${limit}, Current: ${teamData.memberCount}). Cannot add user ${user.id}.`);
          return { error: `The team you were invited to has reached its member limit (${limit}) for the current plan.` };
        }
      } catch (dbError) {
        console.error(`Sign Up: Database error checking team member limit for team ${teamIdNum}:`, dbError);
        return { error: "Database error verifying team capacity." };
      }
      // --- End Limit Check ---

      const newMemberData: NewTeamMember = {
        userId: user.id,
        teamId: teamIdNum,
        role: role,
      };
      await db.insert(teamMembers).values(newMemberData);
      console.log(`Successfully inserted user ${user.id} into team_members for team ${teamIdNum}`);

      // 2. Update the invitation status to 'accepted'
      if (!inviteToken) { 
         console.warn("Sign Up: inviteToken became null/undefined unexpectedly during invite update.");
      } else {
          const updateResult = await db.update(invitations)
             .set({ status: 'accepted' })
             .where(eq(invitations.token, inviteToken))
             .returning({ id: invitations.id });
         
         if (updateResult.length > 0) {
             console.log(`Successfully updated invitation status for token ${inviteToken}`);
         } else {
             console.warn(`Could not find or update invitation status for token ${inviteToken}.`);
         }
      }

    } catch (inviteError) {
      console.error(`Error processing invite for user ${user.id}, team ${teamId}, token ${inviteToken}:`, inviteError);
      // Decide how to handle invite processing errors. Should it fail the whole signup?
      // Maybe just log it and let the user sign in, they are already created.
      // Returning a generic error for now, but consider letting signup succeed with a warning.
      return { error: 'Account created, but failed to process the team invitation. Please contact support.' };
    }
    
    // If invite processed successfully, redirect to dashboard (or maybe profile completion?)
    console.log('Invite processed successfully, redirecting...');
    redirect('/dashboard'); 

  } else {
    // If NOT an invite flow, create a personal team for the user
    console.log('Sign up successful (no invite), creating personal team...');
    
    try {
      // Create a personal team for the user
      const teamName = `${fullName}'s Team`;
      const [newTeam] = await db.insert(teams).values({
        name: teamName,
        planName: 'free', // Default to free plan
        // Other team fields will use defaults
      }).returning({ id: teams.id });

      if (!newTeam) {
        throw new Error('Failed to create team');
      }

      console.log(`Created team ${newTeam.id} for user ${user.id}`);

      // Add user as owner of their personal team
      const newMemberData: NewTeamMember = {
        userId: user.id,
        teamId: newTeam.id,
        role: 'owner',
      };
      await db.insert(teamMembers).values(newMemberData);
      console.log(`Added user ${user.id} as owner of team ${newTeam.id}`);

      // Log activity for team creation
      await logActivity(newTeam.id, user.id, ActivityType.SIGN_UP);

    } catch (teamError) {
      console.error(`Error creating personal team for user ${user.id}:`, teamError);
      return { error: 'Account created, but failed to set up your workspace. Please contact support.' };
    }
    
    redirect('/dashboard');
  }
  
  // Default return (should usually be redirected)
  return {}; 
});

export async function signOut() {
  // Remove old logic relying on custom session/getUser
  // const user = (await getUser()) as User;
  // const userWithTeam = await getUserWithTeam(user.id);
  // await logActivity(userWithTeam?.teamId, user.id, ActivityType.SIGN_OUT);
  // (await cookies()).delete('session');

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error signing out:', error);
    // Optionally return an error state if this action is called from a form
    // return { error: 'Failed to sign out.' };
  }

  // Redirect to the sign-in page after successful sign out
  redirect('/sign-in');
}

const updatePasswordSchema = z
  .object({
    // currentPassword is not needed for supabase.auth.updateUser
    // currentPassword: z.string().min(8).max(100),
    newPassword: z.string().min(8).max(100),
    confirmPassword: z.string().min(8).max(100),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'], // Apply validation to confirmPassword field
  });

export const updatePassword = validatedAction(
  updatePasswordSchema,
  // Remove the old user parameter from the function signature
  async (data, formData) => {
    // const { currentPassword, newPassword } = data; // currentPassword not needed
    const { newPassword } = data;
    const supabase = await createClient();

    // 1. Get the current Supabase user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'User not authenticated. Please sign in again.' };
    }

    // 2. Call Supabase to update the user's password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("Supabase password update error:", updateError);
      // Provide a more specific error if possible, otherwise generic
      return { error: updateError.message || 'Failed to update password. Please try again.' };
    }

    // Remove old password comparison and hashing
    // const isPasswordValid = await comparePasswords(...);
    // const newPasswordHash = await hashPassword(newPassword);
    // const userWithTeam = await getUserWithTeam(user.id);

    // Remove direct DB update for passwordHash
    // await Promise.all([
    //   db
    //     .update(users)
    //     .set({ passwordHash: newPasswordHash })
    //     .where(eq(users.id, user.id)),
    //   logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_PASSWORD),
    // ]);

    // TODO: Re-implement activity logging if needed
    // Need to fetch team info based on Supabase user.id first
    // const userWithTeam = await getTeamForSupabaseUser(user.id); // Example function
    // await logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_PASSWORD);

    return { success: 'Password updated successfully.' };
  },
);

const deleteAccountSchema = z.object({
  // No password needed for this refactored version
});

export const deleteAccount = validatedAction(
  deleteAccountSchema,
  // Remove old user parameter
  async (data, formData) => {
    const supabase = await createClient();

    // 1. Get the current Supabase user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'User not authenticated. Please sign in again.' };
    }

    // Remove old password check

    // 2. Perform Application-Level Cleanup (using Supabase user ID)
    let teamId: number | null = null;
    try {
      // Find the user's team membership to get teamId for logging/cleanup
      const [membership] = await db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(eq(teamMembers.userId, user.id)) // Use Supabase user ID (UUID) - Should work now
        .limit(1);

      if (membership) {
        teamId = membership.teamId;
        // Delete from teamMembers table
        await db
          .delete(teamMembers)
          .where(eq(teamMembers.userId, user.id)); // Use Supabase user ID (UUID) - Should work now
      }

      // Delete user profile data
      await db.delete(profiles).where(eq(profiles.id, user.id)); // Use Supabase user ID (UUID)

      // TODO: Add deletion logic for other related application tables?

    } catch (dbError) {
      console.error("Database error during account cleanup:", dbError);
      // return { error: "Failed to clean up account data." }; // Decide on error handling
    }

    // Remove old soft delete logic on public.users table

    // 3. Log activity (if cleanup was successful or regardless)
    if (teamId) {
      await logActivity(
        teamId,
        user.id, // Use Supabase UUID
        ActivityType.DELETE_ACCOUNT,
      );
    }

    // 4. Sign the user out from Supabase
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      console.error("Supabase sign out error during account deletion:", signOutError);
    }

    // Remove old cookie deletion

    // 5. Redirect to sign-in page
    redirect('/sign-in');
  },
);

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
});

export const updateAccount = validatedAction(
  updateAccountSchema,
  async (data, formData) => {
    const { name, email } = data;
    const supabase = await createClient();

    // 1. Get the current Supabase user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'User not authenticated. Please sign in again.' };
    }

    // 2. Prepare update data for Supabase
    const updateData: { email?: string; data?: { name: string } } = {};
    let successMessage = 'Account updated successfully.';

    // Check if email needs updating
    if (email && email !== user.email) {
      updateData.email = email;
      successMessage = 'Account details updated. Please check your new email address for a confirmation link.';
    }

    // Update name in user_metadata
    updateData.data = { name };

    // 3. Call Supabase to update user email and/or metadata
    const { error: updateError } = await supabase.auth.updateUser(updateData);

    if (updateError) {
      console.error("Supabase account update error:", updateError);
      return { error: updateError.message || 'Failed to update account. Please try again.' };
    }

    // Remove old DB update logic
    // const userWithTeam = await getUserWithTeam(user.id);
    // await Promise.all([
    //   db.update(users).set({ name, email }).where(eq(users.id, user.id)),
    //   logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_ACCOUNT),
    // ]);

    // TODO: Re-implement activity logging if needed
    // Need to fetch team info based on Supabase user.id first
    // const userWithTeam = await getTeamForSupabaseUser(user.id); // Example function
    // await logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_ACCOUNT);

    return { success: successMessage };
  },
);

const removeTeamMemberSchema = z.object({
  memberId: z.coerce.number(), // Use coerce to convert string from FormData
});

export const removeTeamMember = validatedAction(
  removeTeamMemberSchema,
  // Remove old user parameter
  async (data, formData) => {
    const { memberId } = data;
    const supabase = await createClient();

    // 1. Get the *acting* Supabase user
    const { data: { user: actingUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !actingUser) {
      return { error: 'User not authenticated' };
    }

    // 2. Get acting user's membership info (teamId, role)
    let actingUserMembership: Pick<TeamMember, 'teamId' | 'role'> | undefined;
    try {
      [actingUserMembership] = await db
        .select({ teamId: teamMembers.teamId, role: teamMembers.role })
        .from(teamMembers)
        .where(eq(teamMembers.userId, actingUser.id)) // Use Supabase UUID
        .limit(1);
    } catch (dbError) {
      console.error("Database error fetching acting user membership:", dbError);
      return { error: "Database error checking permissions." };
    }

    if (!actingUserMembership?.teamId) {
      return { error: 'Acting user is not part of a team' };
    }

    // 3. Permission Check: Ensure acting user is an owner
    if (actingUserMembership.role !== 'owner') {
      return { error: 'Only team owners can remove members.' };
    }

    // 4. Verify the target member exists and belongs to the *same team*
    let targetMembership: Pick<TeamMember, 'teamId' | 'userId'> | undefined;
    try {
        [targetMembership] = await db
            .select({ teamId: teamMembers.teamId, userId: teamMembers.userId })
            .from(teamMembers)
            .where(eq(teamMembers.id, memberId)) // Find by the memberId (integer PK)
            .limit(1);
    } catch (dbError) {
        console.error("Database error fetching target member:", dbError);
        return { error: "Database error finding member to remove." };
    }

    if (!targetMembership) {
        return { error: "Team member not found." };
    }

    if (targetMembership.teamId !== actingUserMembership.teamId) {
        return { error: "Cannot remove a member from another team." };
    }

    // Prevent owner from removing themselves via this action?
    if (targetMembership.userId === actingUser.id) {
        return { error: "Cannot remove yourself from the team via this action." };
    }

    // 5. Delete the target member
    try {
      await db
        .delete(teamMembers)
        .where(eq(teamMembers.id, memberId));
    } catch (dbError) {
      console.error("Database error removing team member:", dbError);
      return { error: "Failed to remove team member." };
    }

    // 6. Log activity
    await logActivity(
      actingUserMembership.teamId,
      actingUser.id, // Logged-in user performing the action
      ActivityType.REMOVE_TEAM_MEMBER,
    );

    return { success: 'Team member removed successfully' };
  },
);

const inviteTeamMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['member', 'owner']),
});

export const inviteTeamMember = validatedAction(
  inviteTeamMemberSchema,
  async (data, formData) => {
    const { email, role: invitedRole } = data;
    const supabase = await createClient();

    // 1. Get the *acting* Supabase user
    const { data: { user: inviterUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !inviterUser) {
      return { error: 'User not authenticated' };
    }

    // 2. Get acting user's membership info (teamId, role)
    let inviterMembership: Pick<TeamMember, 'teamId' | 'role'> | undefined;
    try {
      [inviterMembership] = await db
        .select({ teamId: teamMembers.teamId, role: teamMembers.role })
        .from(teamMembers)
        .where(eq(teamMembers.userId, inviterUser.id))
        .limit(1);
    } catch (dbError) {
      console.error("Database error fetching inviter membership:", dbError);
      return { error: "Database error checking permissions." };
    }

    if (!inviterMembership?.teamId) {
      return { error: 'Inviting user is not part of a team' };
    }

    // 3. Permission Check: Ensure acting user is an owner
    if (inviterMembership.role !== 'owner') {
      return { error: 'Only team owners can invite new members.' };
    }

    const inviterTeamId = inviterMembership.teamId;

    // --- Check Team Member Limit BEFORE Creating Invitation ---
    try {
        const [teamData] = await db.select({ 
                planName: teams.planName, 
                memberCount: count(teamMembers.id) 
            })
            .from(teams)
            .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
            .where(eq(teams.id, inviterTeamId))
            .groupBy(teams.id);

        if (!teamData) {
            return { error: 'Team not found.' };
        }

        const limit = getMemberLimit(teamData.planName);
        if (teamData.memberCount >= limit) {
            return { error: `Team has reached its member limit (${limit}) for the current plan.` };
        }
    } catch (dbError) {
        console.error("Database error checking team member limit:", dbError);
        return { error: "Database error checking team limit." };
    }
    // --- End Limit Check ---

    // 4. Check for existing PENDING invitation (Optional but good practice)
    try {
      const existingInvitation = await db
        .select({ id: invitations.id })
        .from(invitations)
        .where(
          and(
            eq(invitations.email, email),
            eq(invitations.teamId, inviterTeamId),
            eq(invitations.status, 'pending'),
          ),
        )
        .limit(1);

      if (existingInvitation.length > 0) {
        return { error: 'An invitation has already been sent to this email for this team' };
      }
    } catch (dbError) {
      console.error("Database error checking existing invitations:", dbError);
      // Don't block if this check fails, but log it.
    }

    // 5. Invoke the Supabase Edge Function
    try {
      const { data: funcData, error: funcError } = await supabase.functions.invoke(
        'invite-user', // The name of your Edge Function
        {
          body: { 
            teamId: inviterTeamId, 
            email: email, 
            role: invitedRole 
          },
        }
      );

      if (funcError) {
        console.error('Edge Function invocation error:', funcError);
        // Try to return a meaningful error from the function if possible
        const errorDetail = funcError.context?.error?.message || funcError.message;
        return { error: `Failed to send invitation: ${errorDetail}` };
      }

      console.log('Edge Function Response:', funcData); // Log success response if any

      // Assuming function handles DB insert and email

    } catch (invokeError) { // Catch potential network or other errors during invoke
       console.error("Error invoking Supabase function:", invokeError);
       return { error: "A network error occurred while sending the invitation." };
    }

    // 6. Log Activity (Still useful)
    await logActivity(
      inviterTeamId,
      inviterUser.id,
      ActivityType.INVITE_TEAM_MEMBER,
    );

    // Email sending is now handled by the Edge Function

    return { success: 'Invitation sent successfully' };
  },
);
