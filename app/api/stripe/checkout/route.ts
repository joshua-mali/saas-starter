import { setSession } from '@/lib/auth/session';
// Removed db imports as database operations are moved to webhook
// import { db } from '@/lib/db/drizzle';
// import { authUsers, teamMembers, teams } from '@/lib/db/schema';
import { stripe } from '@/lib/payments/stripe';
// import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
// Removed supabaseAdmin import
// import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    console.log('Checkout route called without session_id');
    return NextResponse.redirect(new URL('/pricing', request.url));
  }

  console.log(`Checkout route processing session: ${sessionId}`);

  try {
    // Retrieve session minimal info just to get client_reference_id
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const userId = session.client_reference_id;
    if (!userId) {
       console.error('No user ID found in session client_reference_id for session:', sessionId);
      // Redirect to login or dashboard, as we can't log the user in.
       return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    console.log(`Checkout successful for user ${userId}, session ${sessionId}. DB update handled by webhook.`);

    // *** Database lookups and updates REMOVED from here ***
    // The webhook handler (`/api/stripe/webhook`) handles updating the team's
    // subscription status, plan name, Stripe IDs, and teacher limit based on
    // the `checkout.session.completed` event.

    // Attempt to set the user session based on the ID from Stripe
    try {
        // Pass the user ID; setSession needs to handle fetching necessary user details if required
        // Or adjust setSession if it absolutely needs the full user object.
        // For now, assuming it can work with just the ID or can fetch user data itself.
        await setSession({ id: userId });
        console.log(`Session set for user ${userId}`);
    } catch (sessionError: any) {
        console.error(`Failed to set session for user ${userId}:`, sessionError.message);
        // Redirect to login even if session setting fails, as payment was successful.
        // The user can log in manually.
        return NextResponse.redirect(new URL('/login?checkout=success', request.url));
    }

    // Redirect user to the dashboard
    console.log(`Redirecting user ${userId} to dashboard.`);
    return NextResponse.redirect(new URL('/dashboard', request.url));

  } catch (error: any) {
    console.error(`Error processing checkout redirect for session ${sessionId}:`, error.message, error.stack);
    // Redirect to an error page or dashboard, maybe with a query param
    return NextResponse.redirect(new URL('/dashboard?checkout_error=true', request.url));
  }
}
