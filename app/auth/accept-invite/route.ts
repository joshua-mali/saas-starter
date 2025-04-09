import { db } from '@/lib/db/drizzle';
import { invitations } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

// Consider moving cookie name/options to constants
const INVITE_COOKIE_NAME = 'supabase-invite-context';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const cookieStore = await cookies();

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = '/sign-up'; // Always redirect to sign-up page
  redirectTo.searchParams.delete('token'); // Clean the token from final URL

  if (!token) {
    console.error('Accept Invite: No token provided.');
    redirectTo.pathname = '/auth/error';
    redirectTo.searchParams.set('error', 'Invalid invitation link: No token provided.');
    return NextResponse.redirect(redirectTo);
  }

  console.log(`Accept Invite: Received token: ${token}`);

  const errorRedirect = (message: string) => {
    redirectTo.pathname = '/auth/error';
    redirectTo.searchParams.set('error', message);
    console.error(`Accept Invite Error: ${message}`);
    return NextResponse.redirect(redirectTo);
  };

  try {
    // Validate token using Drizzle
    const now = new Date();
    const [validInvite] = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        teamId: invitations.teamId,
        role: invitations.role,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        token: invitations.token
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
          return errorRedirect(`This invitation has already been ${existingInvite.status}.`);
        }
        if (existingInvite.expiresAt <= now) {
           return errorRedirect('Invitation has expired.');
        }
      }
      return errorRedirect('Invalid or expired invitation link.');
    }

    console.log(`Accept Invite: Valid token found for email ${validInvite.email}`);

    // --- Successful Validation --- //

    // Prepare redirect URL (only pre-fill email)
    redirectTo.searchParams.set('email', validInvite.email);
    redirectTo.searchParams.set('inviteToken', validInvite.token);
    redirectTo.searchParams.set('teamId', String(validInvite.teamId));
    redirectTo.searchParams.set('role', validInvite.role);

    // Create the response object *before* setting the cookie
    const response = NextResponse.redirect(redirectTo);

    // Prepare cookie payload
    const inviteContext = {
        email: validInvite.email,
        teamId: validInvite.teamId,
        role: validInvite.role,
        inviteToken: validInvite.token
    };

    // Set the cookie on the response object
    response.cookies.set(INVITE_COOKIE_NAME, JSON.stringify(inviteContext), {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 15, // 15 minutes
        sameSite: 'lax'
    });

    console.log(`Accept Invite: Set invite context cookie and redirecting to sign-up: ${redirectTo.search}`);
    return response; // Return the response with the cookie set

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    return errorRedirect(`An error occurred while validating the invitation: ${message}`);
  }
}