import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

// See: https://supabase.com/docs/guides/auth/server-side/nextjs#create-a-route-handler-to-exchange-the-code-for-a-session
export async function GET(request: NextRequest) {
  console.log('Confirm Route: Received URL:', request.url);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/'; // Default redirect if none specified

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete('token_hash');
  redirectTo.searchParams.delete('type');

  const supabase = await createClient();
  let verificationError: string | null = null;

  if (code) {
    // --- Handle PKCE Code Exchange --- //
    console.log('Confirm Route: Attempting code exchange...');
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Auth code exchange error:', error.message);
      verificationError = `Code exchange failed: ${error.message}`;
    } else {
      console.log('Confirm Route: Code exchange successful.');
      // Session is set via cookies, determine redirect path
      // Use 'next' param if provided and valid, otherwise default
      redirectTo.pathname = next; // Defaults to /auth/complete-profile
      // Potentially add logic here based on inviteToken if passed through?
      return NextResponse.redirect(redirectTo);
    }
  } else if (token_hash && type) {
    // --- Handle OTP/Token Hash Verification (e.g., Email Confirmation) --- //
    console.log(`Confirm Route: Attempting OTP verification (type: ${type})...`);
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) {
      console.error(`Auth OTP verification error (type ${type}):`, error.message);
      verificationError = `Verification failed: ${error.message}`;
    } else {
      console.log('Confirm Route: OTP verification successful.');
      // Verification successful, user is effectively logged in (session may be set by verifyOtp depending on flow)
      // Redirect to profile completion or intended destination
      redirectTo.pathname = next; // Defaults to /auth/complete-profile
      redirectTo.searchParams.delete('next');
      redirectTo.pathname = '/dashboard';
      return NextResponse.redirect(redirectTo);
    }
  } else {
    // --- Missing necessary parameters --- //
    console.error('Confirm Route: Missing code or token_hash/type.');
    verificationError = 'Invalid confirmation link: Missing required parameters.';
  }

  // --- Handle Errors --- //
  // If we reached here, verification failed or params were missing
  redirectTo.pathname = '/auth/auth-code-error';
  redirectTo.searchParams.set('error', verificationError || 'Unknown verification error.');
  return NextResponse.redirect(redirectTo);
} 