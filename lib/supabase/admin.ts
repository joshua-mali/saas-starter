import { createClient } from '@supabase/supabase-js'

// Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}

if (!serviceRoleKey) {
  throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY')
}

// IMPORTANT: Never expose the service role key client-side
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    // Using autoRefreshToken: false and persistSession: false is recommended for server-side operations
    // that don't need user session management typical in browsers.
    autoRefreshToken: false,
    persistSession: false,
    // detectSessionInUrl: false, // Generally not needed for server-side
  },
}); 