import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AbuseIPDBBlacklistEntry {
  ipAddress: string;
  abuseConfidenceScore: number;
  lastReportedAt: string;
}

interface AbuseIPDBBlacklistResponse {
  data: AbuseIPDBBlacklistEntry[];
  meta: {
    generatedAt: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[abuseipdb-validator] Starting validation run...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const abuseipdbApiKey = Deno.env.get('ABUSEIPDB_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Clean expired entries
    console.log('[abuseipdb-validator] Cleaning expired blacklist entries...');
    const { error: cleanError } = await supabase.rpc('clean_expired_abuseipdb_blacklist');
    if (cleanError) {
      console.error('[abuseipdb-validator] Error cleaning expired entries:', cleanError);
    }

    // Step 2: Fetch AbuseIPDB Blacklist (confidenceMinimum=70)
    console.log('[abuseipdb-validator] Fetching AbuseIPDB blacklist...');
    const blacklistUrl = 'https://api.abuseipdb.com/api/v2/blacklist?confidenceMinimum=70&limit=10000';
    
    const blacklistResponse = await fetch(blacklistUrl, {
      method: 'GET',
      headers: {
        'Key': abuseipdbApiKey,
        'Accept': 'application/json',
      },
    });

    if (!blacklistResponse.ok) {
      throw new Error(`AbuseIPDB API error: ${blacklistResponse.status} ${blacklistResponse.statusText}`);
    }

    const blacklistData: AbuseIPDBBlacklistResponse = await blacklistResponse.json();
    console.log(`[abuseipdb-validator] Fetched ${blacklistData.data.length} IPs from blacklist`);

    // Step 3: Store blacklist in database (batch upsert)
    console.log('[abuseipdb-validator] Storing blacklist in database...');
    const BATCH_SIZE = 1000;
    let stored = 0;

    for (let i = 0; i < blacklistData.data.length; i += BATCH_SIZE) {
      const batch = blacklistData.data.slice(i, i + BATCH_SIZE);
      const entries = batch.map(entry => ({
        indicator: entry.ipAddress,
        abuse_confidence_score: entry.abuseConfidenceScore,
        last_reported_at: entry.lastReportedAt,
      }));

      const { error: upsertError } = await supabase
        .from('abuseipdb_blacklist')
        .upsert(entries, { onConflict: 'indicator' });

      if (upsertError) {
        console.error('[abuseipdb-validator] Error upserting batch:', upsertError);
      } else {
        stored += entries.length;
      }

      // Rate limiting
      if (i + BATCH_SIZE < blacklistData.data.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[abuseipdb-validator] Stored ${stored} IPs in blacklist cache`);

    // Step 4: Process raw_indicators and validate against blacklist
    console.log('[abuseipdb-validator] Processing raw indicators...');
    
    // Aggregate raw indicators by indicator and count sources
    const BATCH_LIMIT = 5000;
    const { data: rawIndicators, error: fetchError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          indicator,
          kind,
          ARRAY_AGG(DISTINCT source) as sources,
          COUNT(DISTINCT source) as source_count
        FROM raw_indicators
        WHERE removed_at IS NULL
          AND kind = 'ipv4'
        GROUP BY indicator, kind
        LIMIT ${BATCH_LIMIT}
      `
    });

    if (fetchError) {
      console.error('[abuseipdb-validator] Error fetching raw indicators:', fetchError);
      
      // Fallback: query directly
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('raw_indicators')
        .select('indicator, kind, source')
        .eq('kind', 'ipv4')
        .is('removed_at', null)
        .limit(BATCH_LIMIT);

      if (fallbackError) {
        throw new Error(`Failed to fetch raw indicators: ${fallbackError.message}`);
      }

      // Manually aggregate
      const aggregated = new Map<string, { sources: Set<string>; kind: string }>();
      for (const row of fallbackData || []) {
        const key = row.indicator;
        if (!aggregated.has(key)) {
          aggregated.set(key, { sources: new Set(), kind: row.kind });
        }
        aggregated.get(key)!.sources.add(row.source);
      }

      const aggregatedData = Array.from(aggregated.entries()).map(([indicator, data]) => ({
        indicator,
        kind: data.kind,
        sources: Array.from(data.sources),
        source_count: data.sources.size,
      }));

      console.log(`[abuseipdb-validator] Aggregated ${aggregatedData.length} unique indicators`);
      await processIndicators(supabase, aggregatedData);
    } else {
      console.log(`[abuseipdb-validator] Fetched ${rawIndicators?.length || 0} aggregated indicators`);
      await processIndicators(supabase, rawIndicators || []);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        blacklist_count: stored,
        message: 'AbuseIPDB validation completed successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[abuseipdb-validator] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processIndicators(supabase: any, indicators: any[]) {
  let processed = 0;
  let validated = 0;

  for (const indicator of indicators) {
    try {
      // Check if in AbuseIPDB blacklist
      const { data: blacklistEntry, error: checkError } = await supabase
        .from('abuseipdb_blacklist')
        .select('abuse_confidence_score')
        .eq('indicator', indicator.indicator)
        .maybeSingle();

      if (checkError) {
        console.error(`[abuseipdb-validator] Error checking blacklist for ${indicator.indicator}:`, checkError);
        continue;
      }

      const inBlacklist = !!blacklistEntry;
      const abuseScore = blacklistEntry?.abuse_confidence_score || null;

      // Calculate confidence based on sources and AbuseIPDB score
      let confidence = 0;
      if (indicator.source_count >= 3) {
        confidence = 100;
      } else if (indicator.source_count === 2) {
        confidence = 66;
      } else if (indicator.source_count === 1) {
        confidence = 33;
      }

      // Boost confidence if in AbuseIPDB blacklist with high score
      if (inBlacklist && abuseScore && abuseScore >= 70) {
        confidence = Math.max(confidence, abuseScore);
      }

      // Only process if confidence >= 70%
      if (confidence >= 70) {
        const { error: upsertError } = await supabase
          .from('dynamic_raw_indicators')
          .upsert({
            indicator: indicator.indicator,
            kind: indicator.kind,
            confidence,
            sources: indicator.sources,
            source_count: indicator.source_count,
            last_validated: new Date().toISOString(),
            abuseipdb_checked: true,
            abuseipdb_score: abuseScore,
            abuseipdb_in_blacklist: inBlacklist,
          }, { onConflict: 'indicator,kind' });

        if (upsertError) {
          console.error(`[abuseipdb-validator] Error upserting ${indicator.indicator}:`, upsertError);
        } else {
          validated++;
        }
      }

      processed++;

      // Rate limiting
      if (processed % 100 === 0) {
        console.log(`[abuseipdb-validator] Processed ${processed}/${indicators.length} indicators`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

    } catch (error) {
      console.error(`[abuseipdb-validator] Error processing ${indicator.indicator}:`, error);
    }
  }

  console.log(`[abuseipdb-validator] Validation complete: ${validated}/${processed} indicators validated (>= 70% confidence)`);
}
