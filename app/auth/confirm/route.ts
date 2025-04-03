import { type NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

// See: https://supabase.com/docs/guides/auth/server-side/nextjs#create-a-route-handler-to-exchange-the-code-for-a-session
export async function GET(request: NextRequest) {
  console.log('Received confirm URL:', request.url); // Log the full request URL
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  // The 'next' parameter might still be useful if you want to redirect based on the original intent
  // For invites, we'll likely override this later.
  const next = searchParams.get('next') ?? '/dashboard' // Default redirect

  const redirectTo = request.nextUrl.clone()
  // Determine the final redirect path *after* successful session exchange
  // For invites (which don't usually carry a 'next' from the initial link),
  // we typically want to go to a profile completion page.
  // You might need a way to know if this 'code' originated from an invite.
  // If Supabase adds the 'type' parameter alongside 'code', you could use that.
  // Assuming for now that if no 'next' is present, it's an invite flow.
  // A more robust approach might be needed depending on your exact flows.
  const finalRedirectPath = next === '/dashboard' ? '/auth/complete-profile' : next; // Heuristic: if default 'next', assume invite

  redirectTo.pathname = finalRedirectPath // Set default success path
  redirectTo.searchParams.delete('code')
  redirectTo.searchParams.delete('next') // Clean up search params

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Session is set via cookies by exchangeCodeForSession
      // Redirect to the determined success page
      return NextResponse.redirect(redirectTo)
    }

    // Log the code exchange error
    console.error(`Auth code exchange error:`, error.message)
    redirectTo.pathname = '/auth/error'
    redirectTo.searchParams.set('error', 'Code exchange failed: ' + error.message)
    return NextResponse.redirect(redirectTo)

  } else {
    console.error('Auth confirmation failed: Missing code.')
    // Redirect to error page if code is missing
    redirectTo.pathname = '/auth/error'
    redirectTo.searchParams.set('error', 'Email verification failed. Missing code.')
    return NextResponse.redirect(redirectTo)
  }
} 