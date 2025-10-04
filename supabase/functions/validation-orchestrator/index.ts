import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const BATCH_SIZE = 100; // Indicators per run

// Two-phase validation thresholds
const PHASE1_CONFIDENCE_THRESHOLD = 50; // Broad validation with generous validators
const PHASE1_AGREEMENT_THRESHOLD = 1;
const PHASE2_CONFIDENCE_THRESHOLD = 70; // Strict validation with rate-limited validators
const PHASE2_AGREEMENT_THRESHOLD = 2;

// Validator priority groups
const HIGH_PRIORITY_VALIDATORS = ['neutrinoapi', 'safebrowsing', 'otx', 'virustotal'];
const LOW_PRIORITY_VALIDATORS = ['abuseipdb', 'honeydb', 'censys', 'urlscan'];

// Validator weights for score aggregation
const VALIDATOR_WEIGHTS: Record<string, number> = {
  // High priority (generous API limits)
  neutrinoapi: 1.0,
  safebrowsing: 1.2,
  otx: 1.3,
  virustotal: 1.5,
  // Low priority (strict rate limits)
  abuseipdb: 1.5,
  honeydb: 0.8,
  censys: 0.7,
  urlscan: 1.0,
  abuse_ch: 0.7,
};

// Validators by indicator type
const IP_VALIDATORS = ['neutrinoapi', 'safebrowsing', 'otx', 'virustotal', 'honeydb', 'abuseipdb', 'censys'];
const DOMAIN_VALIDATORS = ['safebrowsing', 'otx', 'virustotal', 'urlscan', 'abuse_ch'];

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

    // Step 1: Fetch batch prioritizing indicators missing high-priority validators
    const { data: indicators, error: fetchError } = await supabase
      .from('dynamic_raw_indicators')
      .select('id, indicator, kind, source_count, confidence')
      .or(
        'confidence.is.null,' +
        'confidence.lt.50,' +
        'neutrinoapi_checked.eq.false,' +
        'safebrowsing_checked.eq.false,' +
        'otx_checked.eq.false,' +
        'virustotal_checked.eq.false'
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

        // Two-phase validation logic
        const currentConfidence = (indicator as any).confidence || 0;
        const isPhase1 = currentConfidence < PHASE1_CONFIDENCE_THRESHOLD;
        const threshold = isPhase1 ? PHASE1_CONFIDENCE_THRESHOLD : PHASE2_CONFIDENCE_THRESHOLD;
        const agreementNeeded = isPhase1 ? PHASE1_AGREEMENT_THRESHOLD : PHASE2_AGREEMENT_THRESHOLD;

        // Insert into validated_indicators if meets criteria
        if (confidence >= threshold && agreementCount >= agreementNeeded && !isWhitelisted) {
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

    // Query validator-specific tables
    if (validatorName === 'abuseipdb') {
      const { data: blacklistData } = await supabase
        .from('abuseipdb_blacklist')
        .select('abuse_confidence_score')
        .eq('indicator', indicator.indicator)
        .maybeSingle();
      
      if (blacklistData) {
        checked = true;
        score = blacklistData.abuse_confidence_score;
        malicious = (score !== null && score >= 50);
      }
    } else if (validatorName === 'otx') {
      const { data: otxData } = await supabase
        .from('otx_enrichment')
        .select('score, verdict')
        .eq('indicator', indicator.indicator)
        .eq('kind', indicator.kind)
        .maybeSingle();
      
      if (otxData) {
        checked = true;
        score = otxData.score || 0;
        malicious = (otxData.verdict === 'malicious' || (score !== null && score >= 50));
      }
    } else if (validatorName === 'neutrinoapi') {
      const { data: neutrinoData } = await supabase
        .from('neutrinoapi_blocklist')
        .select('category')
        .eq('indicator', indicator.indicator)
        .maybeSingle();
      
      checked = true; // NeutrinoAPI always checks
      if (neutrinoData) {
        score = 100;
        malicious = true;
      } else {
        score = 0;
        malicious = false;
      }
    } else if (validatorName === 'safebrowsing') {
      const { data: sbData } = await supabase
        .from('google_safebrowsing_cache')
        .select('score, is_threat')
        .eq('indicator', indicator.indicator)
        .eq('kind', indicator.kind)
        .maybeSingle();
      
      if (sbData) {
        checked = true;
        score = sbData.score || 0;
        malicious = sbData.is_threat || false;
      }
    } else if (validatorName === 'honeydb') {
      const { data: honeyData } = await supabase
        .from('honeydb_blacklist')
        .select('threat_score')
        .eq('indicator', indicator.indicator)
        .maybeSingle();
      
      if (honeyData) {
        checked = true;
        score = honeyData.threat_score || 100;
        malicious = true;
      }
    } else if (validatorName === 'virustotal') {
      const { data: vtData } = await supabase
        .from('vendor_checks')
        .select('score, raw')
        .eq('indicator', indicator.indicator)
        .eq('kind', indicator.kind)
        .ilike('vendor', 'virustotal')
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (vtData) {
        checked = true;
        score = vtData.score;
        malicious = (score !== null && score >= 50);
      }
    } else if (validatorName === 'abuse_ch') {
      const { data: abusechData } = await supabase
        .from('abuse_ch_fplist')
        .select('indicator')
        .eq('indicator', indicator.indicator)
        .maybeSingle();
      
      checked = true; // Abuse.ch always checks
      if (abusechData) {
        // In FP list = not malicious
        score = 0;
        malicious = false;
      } else {
        // Not in FP list = potentially malicious
        score = null;
        malicious = null;
      }
    } else if (validatorName === 'urlscan') {
      const { data: urlscanData } = await supabase
        .from('vendor_checks')
        .select('score, raw')
        .eq('indicator', indicator.indicator)
        .eq('kind', indicator.kind)
        .ilike('vendor', 'urlscan')
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (urlscanData) {
        checked = true;
        score = urlscanData.score;
        malicious = (score !== null && score >= 50);
      }
    } else if (validatorName === 'censys') {
      const { data: censysData } = await supabase
        .from('vendor_checks')
        .select('score, raw')
        .eq('indicator', indicator.indicator)
        .eq('kind', indicator.kind)
        .ilike('vendor', 'censys')
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (censysData) {
        checked = true;
        score = censysData.score;
        malicious = (score !== null && score >= 50);
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
