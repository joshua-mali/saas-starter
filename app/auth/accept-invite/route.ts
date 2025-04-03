import { db } from '@/lib/db/drizzle';
import { invitations } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  console.log(`Accept Invite: Received token: ${token}`);

  const errorRedirect = (message: string) => {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/error';
    url.searchParams.set('error', message);
    console.error(`Accept Invite Error: ${message}`);
    return NextResponse.redirect(url);
  };

  if (!token) {
    return errorRedirect('Invalid invitation link: Missing token.');
  }

  try {
    // Validate token using Drizzle
    const now = new Date();
    const [validInvite] = await db
      .select({
        email: invitations.email,
        teamId: invitations.teamId,
        status: invitations.status,
        role: invitations.role,
        id: invitations.id,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.token, token),
          eq(invitations.status, 'pending'), // Ensure it's still pending
          gt(invitations.expiresAt, now)    // Ensure it hasn't expired
        )
      )
      .limit(1);

    if (!validInvite) {
      // Could check specifically why it failed (expired, already used, not found)
      // For now, a generic message is okay.
       // Optional: Check if it exists but is expired/used for a better message
      const [existingInvite] = await db.select({ status: invitations.status, expiresAt: invitations.expiresAt }).from(invitations).where(eq(invitations.token, token)).limit(1);
      if (existingInvite) {
        if (existingInvite.status !== 'pending') {
          return errorRedirect('Invitation has already been accepted.');
        }
        if (existingInvite.expiresAt <= now) {
           return errorRedirect('Invitation has expired.');
        }
      }
      return errorRedirect('Invalid or expired invitation link.');
    }

    console.log(`Accept Invite: Valid token found for email ${validInvite.email}`);

    // --- Successful Validation --- //

    // Option: Update status to 'accepted' immediately (or handle later)
    // You might want to do this *after* the user successfully signs up/in + profile completion
    // await db.update(invitations).set({ status: 'accepted' }).where(eq(invitations.id, validInvite.id));

    // Redirect to Sign Up page, pre-filling email and passing necessary info
    // The signup/complete-profile page will need logic to handle this info later
    // to associate the user with the team.
    const signupUrl = request.nextUrl.clone();
    signupUrl.pathname = '/signup'; // Or potentially '/signin' if user might exist
    signupUrl.searchParams.set('email', validInvite.email);
    // Pass necessary info for sign-up completion logic
    signupUrl.searchParams.set('inviteToken', token); // Pass the token for potential re-validation
    signupUrl.searchParams.set('teamId', String(validInvite.teamId));
    signupUrl.searchParams.set('role', validInvite.role);


    console.log(`Accept Invite: Redirecting to signup: ${signupUrl.toString()}`);
    return NextResponse.redirect(signupUrl);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    return errorRedirect(`An error occurred while validating the invitation: ${message}`);
  }
}