// supabase/functions/invite-user/index.ts (Modified for Dashboard)
import "jsr:@supabase/functions-js/edge-runtime.d.ts"; // Keep this for type hints in capable editors
import { createClient } from 'jsr:@supabase/supabase-js@2';
console.log("invite-user function initialized");
// Inlined CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
// Environment variables are read from Secrets set in the dashboard
const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const supabaseServiceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  console.error("Missing required Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY must be set in the Supabase dashboard.");
// Optionally, throw to prevent function execution without secrets
// throw new Error("Missing required secrets");
}
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Ensure method is POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method Not Allowed'
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // --- 1. Extract data and Authorization Header ---
    let email;
    let teamId; // <-- Change type hint to number
    try {
      const body = await req.json();
      email = body.email;
      // Attempt to parse teamId as a number, handle potential errors
      const parsedTeamId = typeof body.teamId === 'number' ? body.teamId : parseInt(body.teamId, 10);
      if (isNaN(parsedTeamId)) {
        throw new Error('teamId must be a valid number.');
      }
      teamId = parsedTeamId;
    } catch (e) {
      if (e.message.includes('teamId must be')) {
        return new Response(JSON.stringify({
          error: 'Bad Request: teamId is invalid or missing'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      console.error("Failed to parse request body:", e);
      return new Response(JSON.stringify({
        error: 'Bad Request: Could not parse JSON body'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!email || !teamId) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: email and teamId'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Missing Authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const token = authHeader.replace('Bearer ', '');
    // --- 2. Authenticate and Authorize Inviter ---
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: {
        persistSession: false
      }
    });
    const { data: { user: inviterUser }, error: getUserError } = await supabaseClient.auth.getUser();
    if (getUserError || !inviterUser) {
      console.error("Error getting inviter user:", getUserError);
      return new Response(JSON.stringify({
        error: 'Invalid token or user not found'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { data: teamMemberData, error: checkOwnerError } = await supabaseClient.from('team_members').select('role').eq('user_id', inviterUser.id).eq('team_id', teamId).eq('role', 'owner').maybeSingle();
    if (checkOwnerError) {
      console.error("Error checking team ownership:", checkOwnerError);
      return new Response(JSON.stringify({
        error: 'Database error checking permissions'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!teamMemberData) {
      console.warn(`User ${inviterUser.id} attempted to invite to team ${teamId} but is not an owner.`);
      return new Response(JSON.stringify({
        error: 'Forbidden: You must be an owner to invite users to this team.'
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // --- 3. Perform Invite (Admin Action) ---
    console.log(`User ${inviterUser.id} is authorized. Inviting ${email} to team ${teamId}...`);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: 'http://localhost:3000/auth/confirm' }
    );
    if (inviteError) {
      console.error("Error inviting user:", inviteError);
      if (inviteError.message.includes("User already registered")) {
        return new Response(JSON.stringify({
          error: 'User already registered',
          details: inviteError.message
        }), {
          status: 409,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      return new Response(JSON.stringify({
        error: 'Failed to invite user',
        details: inviteError.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`Successfully invited ${email}. Invite data:`, inviteData);
    // --- 4. Respond ---
    return new Response(JSON.stringify({
      message: `Invite sent successfully to ${email}`
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error("Unhandled error in function:", error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      details: message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
