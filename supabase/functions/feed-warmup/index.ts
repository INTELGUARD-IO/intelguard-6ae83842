// Feed Warmup Job
// Pre-warms in-memory cache by simulating popular feed requests
// Scheduled via cron every 15 minutes

import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET')!;
const WARMUP_ENABLED = Deno.env.get('ENABLE_FEED_WARMUP') !== 'false'; // Default: true

interface WarmupScenario {
  kind: string;
  format: string;
}

const WARMUP_SCENARIOS: WarmupScenario[] = [
  { kind: 'ipv4', format: 'txt' },
  { kind: 'domain', format: 'txt' },
  { kind: 'ipv4', format: 'json' },
  { kind: 'domain', format: 'json' }
];

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify CRON_SECRET
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== CRON_SECRET) {
      console.log('[WARMUP] Unauthorized: Invalid cron secret');
      return new Response('Unauthorized', { 
        status: 401,
        headers: corsHeaders 
      });
    }

    if (!WARMUP_ENABLED) {
      console.log('[WARMUP] Disabled via feature flag');
      return new Response(JSON.stringify({
        success: true,
        message: 'Warmup disabled via ENABLE_FEED_WARMUP flag'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[WARMUP] Starting cache warmup...');

    // Execute warmup scenarios in parallel
    const results = await Promise.all(
      WARMUP_SCENARIOS.map(async ({ kind, format }) => {
        const start = performance.now();
        
        try {
          // Simulate internal feed request
          const response = await fetch(
            `${SUPABASE_URL}/functions/v1/feed?type=${kind}&format=${format}`,
            {
              headers: {
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
              }
            }
          );

          const duration = performance.now() - start;
          const bodySize = parseInt(response.headers.get('content-length') || '0', 10);

          return {
            scenario: `${kind}/${format}`,
            status: response.status,
            duration_ms: Math.round(duration),
            body_size_bytes: bodySize,
            success: response.ok
          };
        } catch (error: any) {
          const duration = performance.now() - start;
          
          return {
            scenario: `${kind}/${format}`,
            status: 0,
            duration_ms: Math.round(duration),
            body_size_bytes: 0,
            success: false,
            error: error.message
          };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);

    console.log(`[WARMUP] Completed: ${successCount}/${results.length} scenarios successful`);
    console.log(`[WARMUP] Total duration: ${totalDuration}ms`);
    console.log(`[WARMUP] Results:`, JSON.stringify(results, null, 2));

    return new Response(JSON.stringify({
      success: true,
      scenarios: results.length,
      successful: successCount,
      total_duration_ms: totalDuration,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[WARMUP] Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
