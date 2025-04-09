'use server'

import { db } from '@/lib/db/drizzle';
import { invitations, teamMembers } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers'; // Correct import
import { z } from 'zod';

// Schema only validates fullName
const profileSchema = z.object({
    fullName: z.string().min(1, 'Full name cannot be empty.').trim(),
});

// Cookie name constant
const INVITE_COOKIE_NAME = 'supabase-invite-context';

interface ActionResult {
    error?: string | null;
}

// Action only accepts fullName
export async function completeUserProfile(data: { fullName: string }): Promise < ActionResult > {
    const result = profileSchema.safeParse(data)
    if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message).join(', ');
        console.error('Validation failed:', errorMessages);
        return { error: `Invalid input: ${errorMessages}` }
    }

    const { fullName } = result.data;
    const supabase = await createClient();
    const cookieStore = await cookies(); // Get cookie store instance correctly

    // 1. Get the current user
    const { data: { user }, error: getUserError } = await supabase.auth.getUser()
    if (getUserError || !user) {
        console.error('Error getting user in server action:', getUserError)
        return { error: 'Could not authenticate user. Please log in again.' }
    }

    // 2. Update the user's name directly in Supabase Auth metadata
    const { error: updateAuthError } = await supabase.auth.updateUser({
        data: { full_name: fullName } // This updates raw_user_meta_data
    });

    if (updateAuthError) {
        console.error(`Error updating user metadata for ${user.id}:`, updateAuthError);
        return { error: `Failed to update profile name: ${updateAuthError.message}` };
    }
    console.log(`Successfully updated auth metadata (name) for user ${user.id}`);

    // 3. Check for and process invite cookie
    const inviteCookie = cookieStore.get(INVITE_COOKIE_NAME); // Correct usage of .get()
    if (inviteCookie?.value) {
        console.log('Invite cookie found, processing...');
        try {
            const inviteContext = JSON.parse(inviteCookie.value);

            // Basic validation of cookie content
            if (!inviteContext.teamId || !inviteContext.role || !inviteContext.inviteToken) {
                throw new Error('Invalid invite context in cookie.');
            }

            const teamIdNum = parseInt(inviteContext.teamId, 10);
            if (isNaN(teamIdNum)) {
                throw new Error('Invalid teamId in invite context cookie.');
            }

            // Add user to the team_members table
            await db.insert(teamMembers).values({
                userId: user.id, // Use the authenticated user's ID
                teamId: teamIdNum, // Use teamId from cookie
                role: inviteContext.role, // Use role from cookie
                // joined_at uses DB default
            });
            console.log(`Added user ${user.id} to team ${teamIdNum} with role ${inviteContext.role}`);

            // Update the invitation status to 'accepted'
            // Remove updated_at if you have a DB trigger handling it
            await db.update(invitations)
                .set({ status: 'accepted' /* , updated_at: new Date() */ })
                .where(eq(invitations.token, inviteContext.inviteToken));
            console.log(`Updated invitation status for token ${inviteContext.inviteToken}`);

            // Clear the invite cookie after successful processing
            cookieStore.delete(INVITE_COOKIE_NAME); // Correct usage of .delete()
            console.log('Cleared invite context cookie.');

        } catch (inviteError: unknown) {
            console.error("Error processing invite cookie:", inviteError);
            // Log the error but allow profile update to succeed
            // Consider returning a specific error/warning if invite processing is critical
            return { error: `Profile updated, but failed to process team invitation. Please contact support. Details: ${inviteError instanceof Error ? inviteError.message : String(inviteError)}` };
        }
    } else {
        // 4. Handle non-invite flow (create new team? - depends on requirements)
        console.log(`No invite cookie found for user ${user.id}. Skipping team assignment.`);
        // Add default team creation logic here if needed for non-invited users
        // e.g., create a team named "${fullName}'s Team" and add user as owner
    }

    return { error: null } // Indicate overall success
}