import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const BATCH_SIZE = 100; // Indicators per run
const CONFIDENCE_THRESHOLD = 70; // Minimum confidence for validated_indicators
const AGREEMENT_THRESHOLD = 2; // Minimum vendor agreement

// Validator weights for score aggregation
const VALIDATOR_WEIGHTS: Record<string, number> = {
  abuseipdb: 1.5,
  virustotal: 1.5,
  otx: 1.2,
  urlscan: 1.0,
  safebrowsing: 1.0,
  neutrinoapi: 0.8,
  honeydb: 0.8,
  censys: 0.7,
  abuse_ch: 0.7,
};

// Validators by indicator type
const IP_VALIDATORS = ['abuseipdb', 'neutrinoapi', 'honeydb', 'censys', 'otx', 'virustotal', 'safebrowsing'];
const DOMAIN_VALIDATORS = ['abuse_ch', 'urlscan', 'otx', 'virustotal', 'safebrowsing'];

interface IndicatorToValidate {
  id: number;
  indicator: string;
  kind: string;
  source_count: number;
}

interface ValidatorResult {
  name: string;
  checked: boolean;
  score: number | null;
  malicious: boolean | null;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify CRON secret
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== CRON_SECRET) {
      console.error('❌ Unauthorized: Invalid CRON secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🚀 Validation Orchestrator started');
    const startTime = Date.now();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Fetch batch of unvalidated indicators
    const { data: indicators, error: fetchError } = await supabase
      .from('dynamic_raw_indicators')
      .select('id, indicator, kind, source_count')
      .or(
        'confidence.is.null,' +
        'confidence.lt.70,' +
        'abuseipdb_checked.eq.false,' +
        'otx_checked.eq.false,' +
        'virustotal_checked.eq.false,' +
        'safebrowsing_checked.eq.false,' +
        'abuse_ch_checked.eq.false,' +
        'urlscan_checked.eq.false,' +
        'neutrinoapi_checked.eq.false,' +
        'honeydb_checked.eq.false,' +
        'censys_checked.eq.false'
      )
      .order('source_count', { ascending: false })
      .order('first_validated', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw new Error(`Failed to fetch indicators: ${fetchError.message}`);
    }

    if (!indicators || indicators.length === 0) {
      console.log('✅ No indicators to validate');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No indicators to validate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Processing ${indicators.length} indicators`);

    // Step 2: Load Cloudflare Radar Top Domains for false positive filtering
    const { data: topDomains } = await supabase
      .from('cloudflare_radar_top_domains')
      .select('domain');
    
    const cloudflareSet = new Set((topDomains || []).map((d: any) => d.domain.toLowerCase()));
    console.log(`🔍 Loaded ${cloudflareSet.size} Cloudflare Radar top domains for filtering`);

    // Step 3: Process each indicator
    let processed = 0;
    let inserted = 0;
    let whitelisted = 0;

    for (const indicator of indicators as IndicatorToValidate[]) {
      try {
        const results = await validateIndicator(supabase, indicator, cloudflareSet);
        
        // Calculate final confidence
        const { confidence, agreementCount, isWhitelisted } = calculateConfidence(results, indicator.kind, cloudflareSet.has(indicator.indicator.toLowerCase()));

        if (isWhitelisted) {
          whitelisted++;
        }

        // Update dynamic_raw_indicators
        await updateIndicatorValidation(supabase, indicator.id, results, confidence);

        // Insert into validated_indicators if meets criteria
        if (confidence >= CONFIDENCE_THRESHOLD && agreementCount >= AGREEMENT_THRESHOLD && !isWhitelisted) {
          await insertValidatedIndicator(supabase, indicator, results, confidence);
          inserted++;
        }

        processed++;
      } catch (error) {
        console.error(`❌ Error validating ${indicator.indicator}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Completed: ${processed} processed, ${inserted} validated, ${whitelisted} whitelisted in ${duration}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed,
        validated: inserted,
        whitelisted,
        duration_ms: duration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Orchestrator error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function validateIndicator(
  supabase: any,
  indicator: IndicatorToValidate,
  cloudflareSet: Set<string>
): Promise<ValidatorResult[]> {
  const results: ValidatorResult[] = [];
  const validators = indicator.kind === 'ipv4' ? IP_VALIDATORS : DOMAIN_VALIDATORS;

  for (const validatorName of validators) {
    let checked = false;
    let score: number | null = null;
    let malicious: boolean | null = null;

    // Query vendor_checks for existing results
    const { data: checkData } = await supabase
      .from('vendor_checks')
      .select('score, raw')
      .eq('indicator', indicator.indicator)
      .eq('kind', indicator.kind)
      .ilike('vendor', validatorName)
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkData) {
      checked = true;
      score = checkData.score;
      
      // Determine malicious flag based on score
      if (score !== null) {
        malicious = score >= 50;
      }
    }

    results.push({ name: validatorName, checked, score, malicious });
  }

  return results;
}

function calculateConfidence(
  results: ValidatorResult[],
  kind: string,
  inCloudflareTopDomains: boolean
): { confidence: number; agreementCount: number; isWhitelisted: boolean } {
  
  // Cloudflare Radar override for domains
  if (kind === 'domain' && inCloudflareTopDomains) {
    return { confidence: 0, agreementCount: 0, isWhitelisted: true };
  }

  const validResults = results.filter(r => r.checked && r.score !== null);
  
  if (validResults.length === 0) {
    return { confidence: 0, agreementCount: 0, isWhitelisted: false };
  }

  // Calculate weighted average
  let weightedSum = 0;
  let totalWeight = 0;
  let agreementCount = 0;

  for (const result of validResults) {
    const weight = VALIDATOR_WEIGHTS[result.name] || 1.0;
    weightedSum += (result.score || 0) * weight;
    totalWeight += weight;
    
    if ((result.score || 0) >= 70) {
      agreementCount++;
    }
  }

  const confidence = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;

  return { confidence, agreementCount, isWhitelisted: false };
}

async function updateIndicatorValidation(
  supabase: any,
  indicatorId: number,
  results: ValidatorResult[],
  confidence: number
): Promise<void> {
  const updates: any = { confidence };

  for (const result of results) {
    const prefix = result.name.replace(/_/g, '').toLowerCase();
    
    // Update checked flags
    if (prefix === 'abuseipdb') {
      updates.abuseipdb_checked = result.checked;
      updates.abuseipdb_score = result.score;
    } else if (prefix === 'otx') {
      updates.otx_checked = result.checked;
      updates.otx_score = result.score;
    } else if (prefix === 'virustotal') {
      updates.virustotal_checked = result.checked;
      updates.virustotal_score = result.score;
      updates.virustotal_malicious = result.malicious;
    } else if (prefix === 'safebrowsing' || prefix === 'googlesafebrowsing') {
      updates.safebrowsing_checked = result.checked;
      updates.safebrowsing_score = result.score;
    } else if (prefix === 'abusech') {
      updates.abuse_ch_checked = result.checked;
    } else if (prefix === 'urlscan') {
      updates.urlscan_checked = result.checked;
      updates.urlscan_score = result.score;
      updates.urlscan_malicious = result.malicious;
    } else if (prefix === 'neutrinoapi') {
      updates.neutrinoapi_checked = result.checked;
    } else if (prefix === 'honeydb') {
      updates.honeydb_checked = result.checked;
      updates.honeydb_threat_score = result.score;
    } else if (prefix === 'censys') {
      updates.censys_checked = result.checked;
      updates.censys_score = result.score;
      updates.censys_malicious = result.malicious;
    }
  }

  updates.last_validated = new Date().toISOString();

  const { error } = await supabase
    .from('dynamic_raw_indicators')
    .update(updates)
    .eq('id', indicatorId);

  if (error) {
    console.error(`Failed to update indicator ${indicatorId}:`, error);
  }
}

async function insertValidatedIndicator(
  supabase: any,
  indicator: IndicatorToValidate,
  results: ValidatorResult[],
  confidence: number
): Promise<void> {
  
  // Extract country and ASN from enrichment data if available
  let country: string | null = null;
  let asn: string | null = null;

  if (indicator.kind === 'ipv4') {
    // Try OTX enrichment
    const { data: otxData } = await supabase
      .from('otx_enrichment')
      .select('country, asn')
      .eq('indicator', indicator.indicator)
      .maybeSingle();
    
    if (otxData) {
      country = otxData.country;
      asn = otxData.asn;
    }

    // Fallback to BGPView or Cloudflare Radar enrichment
    if (!country || !asn) {
      const { data: bgpData } = await supabase
        .from('bgpview_enrichment')
        .select('country_code, asn')
        .eq('indicator', indicator.indicator)
        .maybeSingle();
      
      if (bgpData) {
        country = country || bgpData.country_code;
        asn = asn || (bgpData.asn ? String(bgpData.asn) : null);
      }
    }
  }

  const { error } = await supabase
    .from('validated_indicators')
    .upsert({
      indicator: indicator.indicator,
      kind: indicator.kind,
      confidence,
      country,
      asn,
      last_validated: new Date().toISOString(),
    }, {
      onConflict: 'indicator,kind',
    });

  if (error) {
    console.error(`Failed to insert validated indicator ${indicator.indicator}:`, error);
  }
}
