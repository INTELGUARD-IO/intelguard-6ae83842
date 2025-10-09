// source-health-check: Periodically check health of all ingest sources
// Re-enables sources that come back online, logs errors for down sources

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate CRON_SECRET or JWT authorization
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('authorization');
  
  const validCronSecret = expectedSecret && cronSecret === expectedSecret;
  const validAuth = authHeader && authHeader.startsWith('Bearer ');
  
  if (!validCronSecret && !validAuth) {
    console.error('[health-check] Unauthorized: Invalid CRON_SECRET and no valid authorization header');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    console.log('[health-check] Starting health check for all sources');

    // Fetch ALL sources (enabled and disabled)
    const { data: sources, error: sourcesError } = await supabase
      .from('ingest_sources')
      .select('*')
      .order('name');

    if (sourcesError) throw sourcesError;
    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No sources to check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    
    for (const source of sources) {
      console.log(`[health-check] Testing ${source.name}...`);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const response = await fetch(source.url, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'intelguard/health-check/1.0',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        const isHealthy = response.ok;
        const statusCode = response.status;
        
        // Se la sorgente è healthy e era disabilitata, riabilitala
        if (isHealthy && !source.enabled) {
          await supabase
            .from('ingest_sources')
            .update({ 
              enabled: true,
              last_error: null,
            })
            .eq('id', source.id);
          
          console.log(`[health-check] ✓ ${source.name} is back online! Re-enabled.`);
        }
        
        // Se non è healthy e era abilitata, segnala l'errore
        if (!isHealthy && source.enabled) {
          await supabase
            .from('ingest_sources')
            .update({ 
              last_error: `Health check failed: HTTP ${statusCode}`,
            })
            .eq('id', source.id);
          
          console.log(`[health-check] ✗ ${source.name} failed: HTTP ${statusCode}`);
        }
        
        results.push({
          name: source.name,
          url: source.url,
          status: statusCode,
          healthy: isHealthy,
          enabled: source.enabled,
          action: isHealthy && !source.enabled ? 're-enabled' : 'no change',
        });
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[health-check] Error checking ${source.name}:`, errorMsg);
        
        results.push({
          name: source.name,
          url: source.url,
          status: 'error',
          healthy: false,
          enabled: source.enabled,
          error: errorMsg,
        });
      }
      
      // Pausa tra richieste per non sovraccaricare
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[health-check] Completed. Checked ${results.length} sources`);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results,
        summary: {
          total: results.length,
          healthy: results.filter(r => r.healthy).length,
          unhealthy: results.filter(r => !r.healthy).length,
          re_enabled: results.filter(r => r.action === 're-enabled').length,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[health-check] Error:', errorMsg);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
