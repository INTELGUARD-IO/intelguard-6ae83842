import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📧 Whitelist Email Report: Starting...\n');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Fetch stats from last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      ciscoCount,
      cloudflareCount,
      whitelistedToday,
      deepValidatedToday,
      ciscoOnlyCount,
      cloudflareOnlyCount,
      bothCount
    ] = await Promise.all([
      supabase.from('cisco_umbrella_top_domains').select('*', { count: 'exact', head: true }),
      supabase.from('cloudflare_radar_top_domains').select('*', { count: 'exact', head: true }),
      supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('whitelisted', true).gte('last_validated', twentyFourHoursAgo),
      supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('whitelisted', false).gte('last_validated', twentyFourHoursAgo),
      supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('whitelist_source', 'cisco').gte('last_validated', twentyFourHoursAgo),
      supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('whitelist_source', 'cloudflare').gte('last_validated', twentyFourHoursAgo),
      supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('whitelist_source', 'both').gte('last_validated', twentyFourHoursAgo)
    ]);

    const totalWhitelisted = whitelistedToday.count || 0;
    const totalDeepValidated = deepValidatedToday.count || 0;
    const quotaSaved = totalWhitelisted * 10;
    const moneySaved = Math.round(quotaSaved * 0.02);

    const today = new Date().toISOString().split('T')[0];

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 10px 10px 0 0;
      text-align: center;
    }
    .content {
      background: #f8f9fa;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .stat-box {
      background: white;
      padding: 20px;
      margin: 15px 0;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .stat-label {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: #111827;
    }
    .breakdown {
      background: white;
      padding: 20px;
      margin: 15px 0;
      border-radius: 8px;
    }
    .breakdown-item {
      display: flex;
      justify-between;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .breakdown-item:last-child {
      border-bottom: none;
    }
    .success {
      color: #10b981;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0;">🛡️ Daily Whitelist Report</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">${today}</p>
  </div>
  
  <div class="content">
    <h2>Whitelist Status</h2>
    
    <div class="stat-box">
      <div class="stat-label">Cisco Umbrella Domains</div>
      <div class="stat-value">${(ciscoCount.count || 0).toLocaleString()}</div>
    </div>
    
    <div class="stat-box">
      <div class="stat-label">Cloudflare Radar Domains</div>
      <div class="stat-value">${(cloudflareCount.count || 0).toLocaleString()}</div>
    </div>
    
    <h2 style="margin-top: 30px;">Today's Validation Results</h2>
    
    <div class="breakdown">
      <h3 style="margin-top: 0;">Total Processed: ${(totalWhitelisted + totalDeepValidated).toLocaleString()}</h3>
      
      <div class="breakdown-item">
        <span>✅ Whitelisted (confidence=0)</span>
        <strong>${totalWhitelisted.toLocaleString()} (${Math.round((totalWhitelisted / (totalWhitelisted + totalDeepValidated)) * 100)}%)</strong>
      </div>
      
      <div style="margin-left: 20px; font-size: 14px; color: #6b7280;">
        <div class="breakdown-item">
          <span>• Both lists</span>
          <span>${(bothCount.count || 0).toLocaleString()}</span>
        </div>
        <div class="breakdown-item">
          <span>• Cisco only</span>
          <span>${(ciscoOnlyCount.count || 0).toLocaleString()}</span>
        </div>
        <div class="breakdown-item">
          <span>• Cloudflare only</span>
          <span>${(cloudflareOnlyCount.count || 0).toLocaleString()}</span>
        </div>
      </div>
      
      <div class="breakdown-item">
        <span>🔍 Deep Validated</span>
        <strong>${totalDeepValidated.toLocaleString()} (${Math.round((totalDeepValidated / (totalWhitelisted + totalDeepValidated)) * 100)}%)</strong>
      </div>
    </div>
    
    <div class="stat-box" style="border-left-color: #10b981;">
      <div class="stat-label">API Quota Saved Today</div>
      <div class="stat-value success">
        ~${quotaSaved.toLocaleString()} calls
      </div>
      <p style="margin: 10px 0 0 0; color: #6b7280;">
        Estimated savings: <strong style="color: #10b981;">$${moneySaved}</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>This is an automated report from your IntelGuard Validation System</p>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
    `;

    // Get super admin email
    const { data: superAdminData } = await supabase
      .rpc('get_super_admin_email');

    const recipientEmail = superAdminData || 'luca.salvatori.pisa@gmail.com';

    // Send email via Resend API
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'IntelGuard <onboarding@resend.dev>',
        to: [recipientEmail],
        subject: `Daily Whitelist Report - ${today}`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      throw new Error(`Resend API error: ${errorData}`);
    }

    console.log('✅ Email sent successfully to:', recipientEmail);

    return new Response(JSON.stringify({
      success: true,
      message: 'Email report sent successfully',
      stats: {
        ciscoCount: ciscoCount.count,
        cloudflareCount: cloudflareCount.count,
        whitelistedToday: totalWhitelisted,
        deepValidatedToday: totalDeepValidated,
        quotaSaved,
        moneySaved
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Error in whitelist-email-report:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
