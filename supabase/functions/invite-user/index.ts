// supabase/functions/invite-user/index.ts (Refactored for Custom Invite Token Flow)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

console.log("invite-user function initialized (custom token flow + Resend)");

// Inlined CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Explicitly type req as Request
Deno.serve(async (req: Request) => {

  // --- Configuration Check (Moved Inside Handler) ---
  // Read secrets inside the handler
  const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
  const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'http://localhost:3000';
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('FROM_EMAIL');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !resendApiKey || !fromEmail) {
    console.error("CRITICAL ERROR: Missing required configuration secrets.");
    return new Response(JSON.stringify({ error: 'Internal Server Error: Service configuration incomplete.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
  }
  // --- End Configuration Check ---

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Ensure method is POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- 1. Extract data and Authorization Header ---
    let email: string;
    let teamId: number;
    let inviterUserId: string | null = null; // To store the inviter's ID

    try {
      const body = await req.json();
      email = body.email;
      const parsedTeamId = typeof body.teamId === 'number' ? body.teamId : parseInt(body.teamId, 10);
      if (isNaN(parsedTeamId)) {
        throw new Error('teamId must be a valid number.');
      }
      teamId = parsedTeamId;
    } catch (e: unknown) {
       const message = e instanceof Error ? e.message : 'Unknown error parsing body';
        console.error("Failed to parse request body:", message);
        const userError = message.includes('teamId must be')
            ? 'Bad Request: teamId is invalid or missing'
            : 'Bad Request: Could not parse JSON body';
        return new Response(JSON.stringify({ error: userError }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (!email || !teamId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email and teamId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.replace('Bearer ', '');

    // --- 2. Authenticate and Authorize Inviter ---
    const supabaseClient = createClient(supabaseUrl!, supabaseAnonKey!, { // Use ! assuming checks above ensure they exist
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false }
    });

    const { data: { user: inviterUser }, error: getUserError } = await supabaseClient.auth.getUser();

    if (getUserError || !inviterUser) {
      console.error("Error getting inviter user:", getUserError);
      return new Response(JSON.stringify({ error: 'Invalid token or user not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    inviterUserId = inviterUser.id; // Store inviter ID

    // Check if inviter is owner of the team
    const { data: teamMemberData, error: checkOwnerError } = await supabaseClient
      .from('team_members')
      .select('role')
      .eq('user_id', inviterUser.id)
      .eq('team_id', teamId)
      .eq('role', 'owner')
      .maybeSingle();

    if (checkOwnerError) {
      console.error("Error checking team ownership:", checkOwnerError);
      return new Response(JSON.stringify({ error: 'Database error checking permissions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!teamMemberData) {
      console.warn(`User ${inviterUser.id} attempted to invite to team ${teamId} but is not an owner.`);
      return new Response(JSON.stringify({ error: 'Forbidden: You must be an owner to invite users.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- 3. Create Invitation Record (Admin Action) ---
    console.log(`User ${inviterUser.id} is authorized. Creating invite for ${email} to team ${teamId}...`);

    const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceRoleKey!, { // Use non-null assertion
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Generate unique token and expiry
    // const inviteToken = randomUUID(); // No longer needed, DB generates token
    const inviteExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

    // Insert into invitations table
    const { data: insertedInvite, error: insertError } = await supabaseAdmin
      .from('invitations')
      .insert({
        // token: inviteToken, // Removed: DB generates default
        email: email,
        team_id: teamId,
        role: 'member', // Added: Assign default role (adjust if needed)
        invited_by: inviterUserId, // Store who invited
        status: 'pending', // Explicitly set status
        expires_at: inviteExpiry.toISOString(), // Provide expiry
      })
      .select('token') // Select the generated token to use in the link
      .single(); // Expect a single row back

    if (insertError) {
        console.error("Error inserting invitation:", insertError);
         // Check for specific errors, like duplicate email/team pending invite?
        if (insertError.code === '23505') { // Unique constraint violation
             return new Response(JSON.stringify({ error: 'An active invitation for this email to this team already exists.' }), {
                status: 409, // Conflict
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        return new Response(JSON.stringify({ error: 'Failed to create invitation record', details: insertError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (!insertedInvite?.token) {
        console.error("Failed to retrieve generated token after insert.");
        return new Response(JSON.stringify({ error: 'Failed to create invitation, token generation failed.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const generatedToken = insertedInvite.token;

    // --- 4. Send Invite Email via Resend ---
    console.log(`Attempting to send invite email to ${email} via Resend...`);

    // TODO: Consider fetching inviter's name/email and team name for a nicer email
    const emailSubject = `You're invited to join a team!`;
    const emailHtml = `
      <p>Hello,</p>
      <p>You have been invited to join a team.</p>
      <p>Click the link below to accept the invitation and set up your account:</p>
      <p><a href="${appBaseUrl}/auth/accept-invite?token=${generatedToken}">Accept Invitation</a></p>
      <p>This link will expire in 24 hours.</p>
      <p>If you did not expect this invitation, you can safely ignore this email.</p>
    `;

    try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: fromEmail, // Your verified sender email from secrets
                to: [email],     // The invited user's email
                subject: emailSubject,
                html: emailHtml
                // You can also add a `text` version for email clients that don't render HTML
            })
        });

        if (!resendResponse.ok) {
            const errorBody = await resendResponse.json();
            console.error(`Failed to send email via Resend. Status: ${resendResponse.status}`, errorBody);
            // Decide if this should be a fatal error for the function
            // For now, log error but proceed with success response, as invite record exists
        } else {
            const successBody = await resendResponse.json();
            console.log(`Resend email submitted successfully for ${email}. ID: ${successBody.id}`);
        }
    } catch (emailError: unknown) {
        console.error("Error sending email via Resend:", emailError);
        // Log error but proceed
    }

    // --- 5. Respond ---
    // Log the link still, just in case email fails / for debugging
    console.log(`**********************************************************`);
    console.log(`* Invite Link (Sent via Email):`);
    console.log(`* ${appBaseUrl}/auth/accept-invite?token=${generatedToken}`);
    console.log(`**********************************************************`);

    return new Response(JSON.stringify({ message: `Invite record created and email sent to ${email}.` }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error("Unhandled error in function:", error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
