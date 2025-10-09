import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Enforce CRON_SECRET
  const secret = Deno.env.get('CRON_SECRET');
  if (req.headers.get('x-cron-secret') !== secret) {
    console.error('Invalid cron secret');
    return new Response('forbidden', { status: 403 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[email-dispatch] Starting email dispatch...');

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
    const dayOfMonth = today.getDate();

    // TODO: Query email_preferences to determine which users should receive emails
    //
    // Logic:
    // - Daily: Send every day
    // - Weekly: Send on Monday (dayOfWeek === 1)
    // - Monthly: Send on 1st of month (dayOfMonth === 1)
    //
    // const { data: prefs, error: prefsError } = await supabase
    //   .from('email_preferences')
    //   .select('user_id, freq, type')
    //   .or(`freq.eq.daily,and(freq.eq.weekly,${dayOfWeek === 1}),and(freq.eq.monthly,${dayOfMonth === 1})`);
    //
    // For each user:
    // 1. Fetch validated_indicators matching their type (ipv4 or domains)
    // 2. Format as .txt (one per line + trailing newline)
    // 3. Send email using Resend API (requires RESEND_API_KEY)
    //
    // TODO: Get RESEND_API_KEY from Deno.env
    // const resendKey = Deno.env.get('RESEND_API_KEY');
    //
    // Example email:
    // await fetch('https://api.resend.com/emails', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${resendKey}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     from: 'feeds@yourdomain.com',
    //     to: userEmail,
    //     subject: 'Your Daily Threat Feed',
    //     text: indicatorsText
    //   })
    // });

    const recipientCount = 0;

    console.log('[email-dispatch] TODO: Query email_preferences and send emails via Resend');
    console.log(`[email-dispatch] Would send to ${recipientCount} recipients`);

    return new Response(
      JSON.stringify({ success: true, sent: recipientCount }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[email-dispatch] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
