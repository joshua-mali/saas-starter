'use server'

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Basic schema for validation
const profileSchema = z.object({
    password: z.string().min(6, 'Password must be at least 6 characters long.'),
    fullName: z.string().min(1, 'Full name cannot be empty.').trim(),
})

interface ActionResult {
    error?: string | null;
}

export async function completeUserProfile(data: { password: string; fullName: string }): Promise<ActionResult> {
    const result = profileSchema.safeParse(data)
    if (!result.success) {
        // Combine Zod errors into a single message
        const errorMessages = result.error.errors.map(e => e.message).join(', ');
        console.error('Validation failed:', errorMessages);
        return { error: `Invalid input: ${errorMessages}` }
    }

    const { password, fullName } = result.data
    const supabase = await createClient()

    // 1. Get the current user
    const { data: { user }, error: getUserError } = await supabase.auth.getUser()

    if (getUserError || !user) {
        console.error('Error getting user in server action:', getUserError)
        return { error: 'Could not authenticate user. Please log in again.' }
    }

    // 2. Update the user's password
    const { error: updateAuthError } = await supabase.auth.updateUser({
        password: password,
    })

    if (updateAuthError) {
        console.error(`Error updating password for user ${user.id}:`, updateAuthError)
        return { error: `Failed to update password: ${updateAuthError.message}` }
    }

    // 3. Update the user's profile (full name)
    const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({
            full_name: fullName, // Ensure your 'profiles' table has a 'full_name' column
            updated_at: new Date().toISOString(),
         })
        .eq('id', user.id) // Match the profile with the authenticated user's ID

    if (updateProfileError) {
        console.error(`Error updating profile for user ${user.id}:`, updateProfileError)
        // Note: Password was updated successfully, but profile failed.
        // Might want more sophisticated error handling/rollback depending on requirements.
        return { error: `Password updated, but failed to update profile name: ${updateProfileError.message}` }
    }

    console.log(`Successfully completed profile for user ${user.id}`);
    return { error: null } // Indicate success
} 