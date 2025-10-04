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
const PHASE2_AGREEMENT_THRESHOLD = 1;

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

// Validators by indicator type (edge function names)
const IP_VALIDATORS = ['neutrinoapi-validator', 'google-safebrowsing-validator', 'otx-validator', 'virustotal-validator', 'honeydb-validator', 'abuseipdb-validator', 'censys-validator'];
const DOMAIN_VALIDATORS = ['google-safebrowsing-validator', 'otx-validator', 'virustotal-validator', 'urlscan-validator', 'abuse-ch-validator'];

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

// Helper function to fetch validator result from cache after invocation
async function fetchValidatorResult(
  supabase: any,
  validatorName: string,
  indicator: IndicatorToValidate
): Promise<ValidatorResult | null> {
  try {
    let score = 0;
    let malicious = false;
    let metadata: any = null;

    // Map validator names to their cache tables and fetch logic
    switch (validatorName) {
      case 'abuseipdb-validator': {
        const { data } = await supabase
          .from('abuseipdb_blacklist')
          .select('*')
          .eq('indicator', indicator.indicator)
          .order('added_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          score = data.abuse_confidence_score || 0;
          malicious = score >= 70;
          metadata = data;
        }
        break;
      }
      
      case 'otx-validator': {
        const { data } = await supabase
          .from('otx_enrichment')
          .select('*')
          .eq('indicator', indicator.indicator)
          .eq('kind', indicator.kind)
          .order('refreshed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          score = data.score || 0;
          malicious = data.verdict === 'malicious';
          metadata = data;
        }
        break;
      }
      
      case 'neutrinoapi-validator': {
        const { data } = await supabase
          .from('neutrinoapi_blocklist')
          .select('*')
          .eq('indicator', indicator.indicator)
          .eq('kind', indicator.kind)
          .order('added_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          score = 100; // In blocklist = 100
          malicious = true;
          metadata = data;
        }
        break;
      }
      
      case 'google-safebrowsing-validator': {
        const { data } = await supabase
          .from('google_safebrowsing_cache')
          .select('*')
          .eq('indicator', indicator.indicator)
          .eq('kind', indicator.kind)
          .order('checked_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          score = data.score || 0;
          malicious = data.is_threat || false;
          metadata = data;
        }
        break;
      }
      
      case 'virustotal-validator': {
        const { data } = await supabase
          .from('vendor_checks')
          .select('*')
          .eq('indicator', indicator.indicator)
          .eq('kind', indicator.kind)
          .eq('vendor', 'virustotal')
          .order('checked_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          score = data.score || 0;
          malicious = score >= 70;
          metadata = data;
        }
        break;
      }
      
      case 'censys-validator': {
        const { data } = await supabase
          .from('vendor_checks')
          .select('*')
          .eq('indicator', indicator.indicator)
          .eq('kind', indicator.kind)
          .eq('vendor', 'censys')
          .order('checked_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          score = data.score || 0;
          malicious = score >= 70;
          metadata = data;
        }
        break;
      }
      
      case 'urlscan-validator': {
        const { data } = await supabase
          .from('vendor_checks')
          .select('*')
          .eq('indicator', indicator.indicator)
          .eq('kind', indicator.kind)
          .eq('vendor', 'urlscan')
          .order('checked_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          score = data.score || 0;
          malicious = score >= 70;
          metadata = data;
        }
        break;
      }
      
      case 'honeydb-validator': {
        const { data } = await supabase
          .from('honeydb_blacklist')
          .select('*')
          .eq('indicator', indicator.indicator)
          .order('added_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          score = data.threat_score || 100;
          malicious = true;
          metadata = data;
        }
        break;
      }
      
      case 'abuse-ch-validator': {
        const { data } = await supabase
          .from('abuse_ch_fplist')
          .select('*')
          .eq('indicator', indicator.indicator)
          .eq('kind', indicator.kind)
          .order('added_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          // Abuse.ch FP list = whitelist, so NOT malicious
          score = 0;
          malicious = false;
          metadata = data;
        }
        break;
      }
    }

    const validatorShortName = validatorName.replace('-validator', '').replace('google-', '');
    return {
      name: validatorShortName,
      checked: true,
      score,
      malicious,
    };
  } catch (error) {
    console.error(`Error fetching result for ${validatorName}:`, error);
    return null;
  }
}

// Validate a single indicator using multiple validators (ACTIVE ORCHESTRATOR)
async function validateIndicator(
  supabase: any,
  indicator: IndicatorToValidate,
  cloudflareSet: Set<string>
): Promise<ValidatorResult[]> {
  const results: ValidatorResult[] = [];
  
  // Determine which validators to use based on indicator kind
  const validatorsToCall = indicator.kind === 'ipv4' 
    ? IP_VALIDATORS 
    : DOMAIN_VALIDATORS;
  
  console.log(`[Phase 1] Starting validation for ${indicator.indicator} (${indicator.kind})`);
  console.log(`[Phase 1] Validators to call: ${validatorsToCall.join(', ')}`);
  
  // Phase 1: High-priority validators (parallel calls)
  const highPriorityValidators = validatorsToCall.filter(v => {
    const shortName = v.replace('-validator', '').replace('google-', '');
    return HIGH_PRIORITY_VALIDATORS.includes(shortName);
  });
  
  console.log(`[Phase 1] Calling ${highPriorityValidators.length} high-priority validators...`);
  
  const highPriorityPromises = highPriorityValidators.map(async (validatorName) => {
    try {
      console.log(`[Phase 1] Invoking ${validatorName}...`);
      
      // Invoke the validator edge function with CRON secret
      const { data, error } = await supabase.functions.invoke(validatorName, {
        headers: {
          'x-cron-secret': CRON_SECRET || ''
        },
        body: { 
          indicators: [indicator.indicator],
          kind: indicator.kind 
        }
      });
      
      if (error) {
        console.error(`[Phase 1] Error from ${validatorName}:`, error);
        return null;
      }
      
      console.log(`[Phase 1] ${validatorName} responded successfully`);
      
      // Wait a moment for the validator to write to cache
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Fetch the result from cache
      const result = await fetchValidatorResult(supabase, validatorName, indicator);
      return result;
    } catch (error) {
      console.error(`[Phase 1] Exception calling ${validatorName}:`, error);
      return null;
    }
  });
  
  const highPriorityResults = await Promise.all(highPriorityPromises);
  const validHighPriorityResults = highPriorityResults.filter(r => r !== null) as ValidatorResult[];
  results.push(...validHighPriorityResults);
  
  console.log(`[Phase 1] Completed: ${validHighPriorityResults.length}/${highPriorityValidators.length} validators responded`);
  
  // Calculate current confidence after Phase 1
  const inCloudflareTopDomains = cloudflareSet.has(indicator.indicator.toLowerCase());
  const phase1Confidence = calculateConfidence(results, indicator.kind, inCloudflareTopDomains);
  console.log(`[Phase 1] Current confidence: ${phase1Confidence.confidence.toFixed(2)}, agreement: ${phase1Confidence.agreementCount}`);
  
  // Add delay between phases to respect rate limits
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Phase 2: Low-priority validators (only if Phase 1 confidence < threshold)
  if (phase1Confidence.confidence < PHASE2_CONFIDENCE_THRESHOLD) {
    const lowPriorityValidators = validatorsToCall.filter(v => {
      const shortName = v.replace('-validator', '').replace('google-', '');
      return LOW_PRIORITY_VALIDATORS.includes(shortName);
    });
    
    console.log(`[Phase 2] Confidence below ${PHASE2_CONFIDENCE_THRESHOLD}, calling ${lowPriorityValidators.length} low-priority validators...`);
    
    // Sequential calls to respect strict rate limits
    for (const validatorName of lowPriorityValidators) {
      try {
        console.log(`[Phase 2] Invoking ${validatorName}...`);
        
        const { data, error } = await supabase.functions.invoke(validatorName, {
          headers: {
            'x-cron-secret': CRON_SECRET || ''
          },
          body: { 
            indicators: [indicator.indicator],
            kind: indicator.kind 
          }
        });
        
        if (error) {
          console.error(`[Phase 2] Error from ${validatorName}:`, error);
        } else {
          console.log(`[Phase 2] ${validatorName} responded successfully`);
          
          // Wait for validator to write to cache
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const result = await fetchValidatorResult(supabase, validatorName, indicator);
          if (result) {
            results.push(result);
          }
        }
        
        // Rate limiting delay between sequential calls
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`[Phase 2] Exception calling ${validatorName}:`, error);
      }
    }
    
    const phase2Confidence = calculateConfidence(results, indicator.kind, inCloudflareTopDomains);
    console.log(`[Phase 2] Final confidence: ${phase2Confidence.confidence.toFixed(2)}, agreement: ${phase2Confidence.agreementCount}`);
  } else {
    console.log(`[Phase 2] Skipped: Phase 1 confidence ${phase1Confidence.confidence.toFixed(2)} >= ${PHASE2_CONFIDENCE_THRESHOLD}`);
  }
  
  console.log(`[Validation Complete] ${indicator.indicator}: ${results.length} validators checked`);
  
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
