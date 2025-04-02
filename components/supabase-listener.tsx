'use client'

import { createClient } from '@/lib/supabase/client'; // Use browser client
import { useRouter } from 'next/navigation'; // Use navigation for App Router
import { useEffect } from 'react';

// Runs in the browser, listens for auth changes and refreshes page if needed
export default function SupabaseListener({ serverAccessToken }: { serverAccessToken?: string }) {
  const router = useRouter()
  const supabase = createClient() // Use the browser client helper

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Compare server token with client session token
      if (session?.access_token !== serverAccessToken) {
        // Server and client session mismatch, force a full page reload
        // This ensures cookies are resent and middleware runs with latest state.
        window.location.reload(); // <-- Force full browser reload
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [serverAccessToken, router, supabase])

  return null // This component doesn't render anything
} 