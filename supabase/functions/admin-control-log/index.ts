import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication: either cron secret OR valid JWT
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('authorization');
    
    const isCronCall = cronSecret === expectedSecret;
    const hasAuthToken = authHeader?.startsWith('Bearer ');
    
    if (!isCronCall && !hasAuthToken) {
      console.error('Unauthorized: No valid cron secret or auth token');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // If auth token present (manual call from UI), verify user is super admin
    if (hasAuthToken && !isCronCall) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!
      );
      
      // Extract JWT token from Bearer header
      const jwt = authHeader!.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
      
      if (userError || !user) {
        console.error('Invalid user token:', userError);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Verify super admin (hardcoded UUID from is_super_admin function)
      const superAdminId = '6a251925-6da6-4e88-a4c2-a5624308fe8e';
      if (user.id !== superAdminId) {
        console.error('User is not super admin');
        return new Response(JSON.stringify({ error: 'Forbidden: Super admin only' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log('Manual call from super admin:', user.email);
    } else {
      console.log('Cron call authenticated');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

    const timestamp = new Date().toISOString();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    console.log('Collecting statistics for control log email...');

    // Collect statistics
    const [
      rawIndicatorsTotal,
      rawIndicatorsLastHour,
      rawIndicatorsIPv4,
      rawIndicatorsDomains,
      validatedIndicatorsTotal,
      validatedIndicatorsLastHour,
      confidenceAvg,
      ingestSourcesTotal,
      ingestSourcesActive,
      recentOperations,
      recentErrors,
      validatorStats,
      networkActivity,
      censysUsage,
    ] = await Promise.all([
      // Raw indicators total
      supabase.from('raw_indicators').select('*', { count: 'exact', head: true }).is('removed_at', null),
      
      // Raw indicators last hour
      supabase.from('raw_indicators').select('*', { count: 'exact', head: true })
        .is('removed_at', null).gte('last_seen', oneHourAgo),
      
      // Raw indicators IPv4
      supabase.from('raw_indicators').select('*', { count: 'exact', head: true })
        .is('removed_at', null).eq('kind', 'ipv4'),
      
      // Raw indicators domains
      supabase.from('raw_indicators').select('*', { count: 'exact', head: true })
        .is('removed_at', null).eq('kind', 'domain'),
      
      // Validated indicators total
      supabase.from('validated_indicators').select('*', { count: 'exact', head: true }),
      
      // Validated indicators last hour
      supabase.from('validated_indicators').select('*', { count: 'exact', head: true })
        .gte('last_validated', oneHourAgo),
      
      // Average confidence
      supabase.from('validated_indicators').select('confidence'),
      
      // Ingest sources total
      supabase.from('ingest_sources').select('*', { count: 'exact', head: true }),
      
      // Ingest sources active
      supabase.from('ingest_sources').select('*', { count: 'exact', head: true }).eq('enabled', true),
      
      // Recent operations
      supabase.from('system_audit_logs').select('*')
        .gte('created_at', oneHourAgo).eq('status', 'completed').order('created_at', { ascending: false }),
      
      // Recent errors
      supabase.from('system_audit_logs').select('*')
        .gte('created_at', oneHourAgo).eq('status', 'failed').order('created_at', { ascending: false }),
      
      // Validator statistics
      supabase.from('dynamic_raw_indicators').select(`
        virustotal_checked,
        abuseipdb_checked,
        censys_checked,
        honeydb_checked,
        neutrinoapi_checked,
        urlscan_checked,
        abuse_ch_checked
      `),
      
      // Network activity
      supabase.from('network_activity_log').select('status')
        .gte('started_at', oneHourAgo),
      
      // Censys usage
      supabase.rpc('get_current_month_censys_usage'),
    ]);

    // Calculate stats
    const totalRaw = rawIndicatorsTotal.count || 0;
    const newRawLastHour = rawIndicatorsLastHour.count || 0;
    const totalIPv4 = rawIndicatorsIPv4.count || 0;
    const totalDomains = rawIndicatorsDomains.count || 0;
    const totalValidated = validatedIndicatorsTotal.count || 0;
    const newValidatedLastHour = validatedIndicatorsLastHour.count || 0;
    
    const avgConfidence = confidenceAvg.data && confidenceAvg.data.length > 0
      ? (confidenceAvg.data.reduce((sum, item) => sum + Number(item.confidence), 0) / confidenceAvg.data.length).toFixed(2)
      : '0';

    const sourcesActive = ingestSourcesActive.count || 0;
    const sourcesTotal = ingestSourcesTotal.count || 0;

    const ingestOps = recentOperations.data?.filter(op => op.operation_type === 'ingest').length || 0;
    const validationOps = recentOperations.data?.filter(op => op.operation_type === 'validation').length || 0;

    const networkCompleted = networkActivity.data?.filter(n => n.status === 'completed').length || 0;
    const networkActive = networkActivity.data?.filter(n => n.status === 'active').length || 0;

    const validatorData = validatorStats.data || [];
    const vtChecked = validatorData.filter(v => v.virustotal_checked).length;
    const abuseipdbChecked = validatorData.filter(v => v.abuseipdb_checked).length;
    const censysChecked = validatorData.filter(v => v.censys_checked).length;
    const honeydbChecked = validatorData.filter(v => v.honeydb_checked).length;
    const neutrinoapiChecked = validatorData.filter(v => v.neutrinoapi_checked).length;
    const urlscanChecked = validatorData.filter(v => v.urlscan_checked).length;
    const abuseChChecked = validatorData.filter(v => v.abuse_ch_checked).length;

    const censysData: any = censysUsage.data?.[0] || { api_calls_count: 0, remaining_calls: 100 };
    const censysCalls = censysData.api_calls_count || 0;
    const censysRemaining = censysData.remaining_calls || 100;

    // Build HTML email
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Courier New', monospace; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6; }
    .header h1 { margin: 0 0 10px 0; color: #60a5fa; font-size: 24px; }
    .header p { margin: 0; color: #94a3b8; font-size: 14px; }
    .section { background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #334155; }
    .section h2 { margin: 0 0 15px 0; color: #60a5fa; font-size: 18px; }
    .separator { border-top: 2px solid #334155; margin: 10px 0; }
    .stat { display: inline-block; margin: 5px 15px 5px 0; color: #e2e8f0; }
    .stat-line { margin: 8px 0; }
    .success { color: #10b981; }
    .warning { color: #f59e0b; }
    .error { color: #ef4444; }
    .muted { color: #94a3b8; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px; }
    .badge-success { background: #10b98120; color: #10b981; }
    .badge-warning { background: #f59e0b20; color: #f59e0b; }
    .badge-error { background: #ef444420; color: #ef4444; }
    .error-item { background: #ef444410; padding: 10px; border-radius: 4px; margin: 5px 0; border-left: 3px solid #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 INTELGUARD Control Log</h1>
      <p>Generated: ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}</p>
    </div>
    
    <div class="section">
      <h2>📊 INDICATORI</h2>
      <div class="separator"></div>
      <p><strong>Raw Indicators:</strong></p>
      <div class="stat-line">
        <span class="stat">• Totali: <strong>${totalRaw}</strong> ${newRawLastHour > 0 ? `<span class="success">(+${newRawLastHour} ultima ora)</span>` : ''}</span>
      </div>
      <div class="stat-line">
        <span class="stat">• IPv4: <strong>${totalIPv4}</strong></span>
        <span class="stat">• Domains: <strong>${totalDomains}</strong></span>
      </div>
      <div class="stat-line">
        <span class="stat">• Fonti Attive: <strong>${sourcesActive}/${sourcesTotal}</strong></span>
      </div>
      
      <p style="margin-top: 20px;"><strong>Validated Indicators:</strong></p>
      <div class="stat-line">
        <span class="stat">• Validati: <strong>${totalValidated}</strong> ${newValidatedLastHour > 0 ? `<span class="success">(+${newValidatedLastHour} ultima ora)</span>` : ''}</span>
      </div>
      <div class="stat-line">
        <span class="stat">• Confidence Media: <strong>${avgConfidence}%</strong></span>
      </div>
    </div>
    
    <div class="section">
      <h2>✅ OPERAZIONI ULTIMA ORA</h2>
      <div class="separator"></div>
      <div class="stat-line">
        <span class="stat">• Ingest: <strong class="success">${ingestOps}</strong> completati</span>
      </div>
      <div class="stat-line">
        <span class="stat">• Validazioni: <strong class="success">${validationOps}</strong> completate</span>
      </div>
      <div class="stat-line">
        <span class="stat">• Network Calls: <strong class="success">${networkCompleted}</strong> completate, <strong class="${networkActive > 0 ? 'warning' : 'muted'}">${networkActive}</strong> attive</span>
      </div>
    </div>
    
    <div class="section">
      <h2>${recentErrors.data && recentErrors.data.length > 0 ? '⚠️' : '✅'} ERRORI E WARNING</h2>
      <div class="separator"></div>
      ${recentErrors.data && recentErrors.data.length > 0 
        ? recentErrors.data.slice(0, 5).map((err: any) => `
          <div class="error-item">
            <strong>${err.operation_name}</strong><br/>
            <span class="muted">${err.description || 'Nessun dettaglio'}</span><br/>
            <span class="muted" style="font-size: 12px;">${new Date(err.created_at).toLocaleString('it-IT')}</span>
          </div>
        `).join('')
        : '<p class="success">✓ Nessun errore critico nelle ultime 24 ore</p>'
      }
    </div>
    
    <div class="section">
      <h2>🔧 VALIDATORI STATUS</h2>
      <div class="separator"></div>
      <div class="stat-line">
        <span class="badge badge-${vtChecked > 0 ? 'success' : 'warning'}">VirusTotal</span>
        <span class="stat">${vtChecked} checks effettuati</span>
      </div>
      <div class="stat-line">
        <span class="badge badge-${abuseipdbChecked > 0 ? 'success' : 'warning'}">AbuseIPDB</span>
        <span class="stat">${abuseipdbChecked} checks effettuati</span>
      </div>
      <div class="stat-line">
        <span class="badge badge-${censysChecked > 0 ? 'success' : 'warning'}">Censys</span>
        <span class="stat">${censysChecked} checks effettuati</span>
      </div>
      <div class="stat-line">
        <span class="badge badge-${honeydbChecked > 0 ? 'success' : 'warning'}">HoneyDB</span>
        <span class="stat">${honeydbChecked} checks effettuati</span>
      </div>
      <div class="stat-line">
        <span class="badge badge-${neutrinoapiChecked > 0 ? 'success' : 'warning'}">NeutrinoAPI</span>
        <span class="stat">${neutrinoapiChecked} checks effettuati</span>
      </div>
      <div class="stat-line">
        <span class="badge badge-${urlscanChecked > 0 ? 'success' : 'warning'}">URLScan</span>
        <span class="stat">${urlscanChecked} checks effettuati</span>
      </div>
      <div class="stat-line">
        <span class="badge badge-${abuseChChecked > 0 ? 'success' : 'warning'}">Abuse.ch</span>
        <span class="stat">${abuseChChecked} checks effettuati</span>
      </div>
    </div>
    
    <div class="section">
      <h2>📈 API USAGE</h2>
      <div class="separator"></div>
      <div class="stat-line">
        <span class="stat">• Censys: <strong class="${censysCalls > 80 ? 'error' : censysCalls > 50 ? 'warning' : 'success'}">${censysCalls}/100</strong> calls utilizzate</span>
        <span class="stat muted">(${censysRemaining} rimanenti questo mese)</span>
      </div>
    </div>
    
    <div style="margin-top: 30px; text-align: center; color: #64748b; font-size: 12px;">
      <p>INTELGUARD Automated Control System</p>
      <p>Questo report viene generato automaticamente ogni ora dalle 8:00 alle 23:00</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Send email via Resend
    console.log('Sending control log email...');
    
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'INTELGUARD Alerts <onboarding@resend.dev>',
        to: ['hsc.pisa@gmail.com', 'luca.salvatori.pisa@gmail.com'],
        subject: `🔍 INTELGUARD Control Log - ${new Date().toLocaleString('it-IT', { 
          hour: '2-digit', 
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })}`,
        html: htmlBody,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Resend API error: ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log('Control log email sent successfully:', emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp,
        emailId: emailResult.id,
        stats: {
          rawIndicators: totalRaw,
          validatedIndicators: totalValidated,
          recentErrors: recentErrors.data?.length || 0,
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in admin-control-log:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
