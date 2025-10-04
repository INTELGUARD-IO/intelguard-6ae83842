import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseQuery } from "../_shared/supabase-rest.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const BATCH_SIZE = 1000;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[CISCO-UMBRELLA-SYNC] Starting Cisco Umbrella Top Domains sync...');

    // Verify CRON secret or authentication
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("authorization");
    
    if (cronSecret !== CRON_SECRET && !authHeader) {
      console.error('[CISCO-UMBRELLA-SYNC] Unauthorized request');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log operation start
    const auditLog = await supabaseQuery(
      SUPABASE_URL,
      SERVICE_KEY,
      'system_audit_logs',
      'POST',
      {
        operation_type: 'data_sync',
        operation_name: 'cisco_umbrella_domains_sync',
        description: 'Syncing Cisco Umbrella Top 100K domains',
        status: 'started',
        metadata: { started_at: new Date().toISOString() }
      }
    );

    const logId = auditLog?.[0]?.id;
    const startTime = Date.now();

    try {
      // Clean expired domains
      console.log('[CISCO-UMBRELLA-SYNC] Cleaning expired domains...');
      try {
        await supabaseQuery(
          SUPABASE_URL,
          SERVICE_KEY,
          'rpc/clean_expired_cisco_umbrella_domains',
          'POST',
          {}
        );
      } catch (cleanError) {
        console.error('[CISCO-UMBRELLA-SYNC] Error cleaning expired domains:', cleanError);
      }

      // Download Cisco Umbrella Top 1M list (we'll use only top 100k)
      console.log('[CISCO-UMBRELLA-SYNC] Downloading Cisco Umbrella Top 1M list...');
      const ciscoUrl = 'http://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip';
      
      const response = await fetch(ciscoUrl, {
        headers: {
          'User-Agent': 'IntelGuard-Validator/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      // Get ZIP file as ArrayBuffer
      const zipData = await response.arrayBuffer();
      console.log(`[CISCO-UMBRELLA-SYNC] Downloaded ${zipData.byteLength} bytes`);

      // Decompress ZIP using Deno's built-in decompression
      const zipFile = new Uint8Array(zipData);
      
      // Use DecompressionStream for ZIP files
      const decompressStream = new DecompressionStream('deflate-raw');
      const reader = new Response(zipFile.slice(30)).body // Skip ZIP header (30 bytes)
        ?.pipeThrough(decompressStream)
        .getReader();

      if (!reader) {
        throw new Error('Failed to create decompression stream');
      }

      // Read decompressed data
      let csvText = '';
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        csvText += decoder.decode(value, { stream: true });
      }

      console.log(`[CISCO-UMBRELLA-SYNC] Decompressed CSV size: ${csvText.length} chars`);

      // Parse CSV and extract top 100k domains
      const lines = csvText.split('\n').filter(line => line.trim());
      const domains: Array<{ domain: string; rank: number }> = [];
      
      // Take only first 100k domains (for consistency with Cloudflare)
      const limit = Math.min(100000, lines.length);
      
      for (let i = 0; i < limit; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const [rankStr, domain] = line.split(',');
        const rank = parseInt(rankStr, 10);
        
        if (domain && !isNaN(rank)) {
          domains.push({ domain: domain.trim(), rank });
        }
      }

      console.log(`[CISCO-UMBRELLA-SYNC] Parsed ${domains.length} domains`);

      // Insert domains in batches
      let inserted = 0;
      
      for (let i = 0; i < domains.length; i += BATCH_SIZE) {
        const batch = domains.slice(i, i + BATCH_SIZE);
        
        const insertData = batch.map(d => ({
          domain: d.domain,
          rank: d.rank,
          added_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }));

        await supabaseQuery(
          SUPABASE_URL,
          SERVICE_KEY,
          'cisco_umbrella_top_domains',
          'POST',
          insertData
        );

        inserted += batch.length;
        console.log(`[CISCO-UMBRELLA-SYNC] Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${inserted}/${domains.length}`);
      }

      const duration = Date.now() - startTime;
      console.log(`[CISCO-UMBRELLA-SYNC] Sync completed successfully in ${duration}ms`);

      // Update audit log
      if (logId) {
        await supabaseQuery(
          SUPABASE_URL,
          SERVICE_KEY,
          'system_audit_logs',
          'PATCH',
          {
            status: 'completed',
            execution_time_ms: duration,
            metadata: {
              started_at: new Date(startTime).toISOString(),
              completed_at: new Date().toISOString(),
              domains_synced: inserted,
              source: 'cisco_umbrella_top_1m'
            }
          },
          `?id=eq.${logId}`
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          domains_synced: inserted,
          duration_ms: duration
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[CISCO-UMBRELLA-SYNC] Sync failed:', error);

      // Update audit log with error
      if (logId) {
        await supabaseQuery(
          SUPABASE_URL,
          SERVICE_KEY,
          'system_audit_logs',
          'PATCH',
          {
            status: 'failed',
            execution_time_ms: duration,
            metadata: {
              started_at: new Date(startTime).toISOString(),
              error: error instanceof Error ? error.message : String(error)
            }
          },
          `?id=eq.${logId}`
        );
      }

      throw error;
    }

  } catch (error) {
    console.error('[CISCO-UMBRELLA-SYNC] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
