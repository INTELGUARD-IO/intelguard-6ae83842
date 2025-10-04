import { corsHeaders } from '../_shared/cors.ts';
import { supabaseQuery, supabaseUpsert } from '../_shared/supabase-rest.ts';
import { logNetworkCall, updateNetworkLog } from '../_shared/network-logger.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OTX_API_KEY = Deno.env.get('OTX_API_KEY');
const OTX_BASE_URL = 'https://otx.alienvault.com/api/v1';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

// Rate limiting: 2 req/s max
const RATE_LIMIT_MS = 500;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface OTXGeneralResponse {
  pulse_info?: {
    count: number;
    pulses?: Array<{
      id: string;
      name: string;
      author: { username: string };
      created: string;
      modified: string;
      tags: string[];
      references: string[];
      description?: string;
    }>;
  };
  base_indicator?: {
    id: string;
    indicator: string;
    type: string;
  };
  type_title?: string;
  country_code?: string;
  asn?: string;
  reputation?: number;
}

interface ScoringResult {
  score: number;
  verdict: string;
  reasons: string[];
}

function calculateScore(
  general: OTXGeneralResponse,
  passiveDns: any,
  urlList: any
): ScoringResult {
  let score = 0;
  const reasons: string[] = [];
  const pulses = general.pulse_info?.pulses || [];
  const pulsesCount = pulses.length;

  // 1. Pulses (max 40 pt)
  if (pulsesCount === 1) {
    score += 10;
    reasons.push(`1 pulse detected (+10)`);
  } else if (pulsesCount >= 2 && pulsesCount <= 3) {
    score += 20;
    reasons.push(`${pulsesCount} pulses detected (+20)`);
  } else if (pulsesCount >= 4 && pulsesCount <= 6) {
    score += 30;
    reasons.push(`${pulsesCount} pulses detected (+30)`);
  } else if (pulsesCount >= 7) {
    score += 40;
    reasons.push(`${pulsesCount}+ pulses detected (+40)`);
  }

  // 2. Authors (max 15 pt)
  const uniqueAuthors = new Set(pulses.map(p => p.author.username)).size;
  if (uniqueAuthors >= 4) {
    score += 15;
    reasons.push(`${uniqueAuthors} distinct authors (+15)`);
  } else if (uniqueAuthors >= 2) {
    score += 10;
    reasons.push(`${uniqueAuthors} distinct authors (+10)`);
  }

  // 3. Recency (max 20 pt)
  const now = Date.now();
  const recentPulses = pulses
    .map(p => new Date(p.modified || p.created).getTime())
    .filter(t => t > 0);
  
  if (recentPulses.length > 0) {
    const latest = Math.max(...recentPulses);
    const daysSince = (now - latest) / (1000 * 60 * 60 * 24);
    
    if (daysSince <= 30) {
      score += 20;
      reasons.push(`Latest pulse ${Math.floor(daysSince)}d ago (+20)`);
    } else if (daysSince <= 90) {
      score += 12;
      reasons.push(`Latest pulse ${Math.floor(daysSince)}d ago (+12)`);
    } else if (daysSince <= 365) {
      score += 6;
      reasons.push(`Latest pulse ${Math.floor(daysSince)}d ago (+6)`);
    }
  }

  // 4. Critical tags (max 15 pt cumulative)
  const criticalTags = ['c2', 'botnet', 'ransomware', 'phishing', 'exploit-kit', 'malware'];
  const allTags = pulses.flatMap(p => p.tags || []).map(t => t.toLowerCase());
  let tagScore = 0;
  const foundCriticalTags: string[] = [];
  
  for (const tag of criticalTags) {
    if (allTags.some(t => t.includes(tag))) {
      tagScore += 5;
      foundCriticalTags.push(tag);
      if (tagScore >= 15) break;
    }
  }
  
  if (foundCriticalTags.length > 0) {
    score += tagScore;
    reasons.push(`Critical tags: ${foundCriticalTags.join(', ')} (+${tagScore})`);
  }

  // 5. Corroboration (max 10 pt)
  const recentUrls = urlList?.url_list?.filter((u: any) => {
    const urlDate = new Date(u.date).getTime();
    return (now - urlDate) / (1000 * 60 * 60 * 24) <= 90;
  }) || [];
  
  if (recentUrls.length > 3) {
    score += 5;
    reasons.push(`${recentUrls.length} recent URLs (+5)`);
  }

  const recentDnsRecords = passiveDns?.passive_dns?.filter((d: any) => {
    const dnsDate = new Date(d.last).getTime();
    return (now - dnsDate) / (1000 * 60 * 60 * 24) <= 90;
  }) || [];
  
  if (recentDnsRecords.length > 10) {
    score += 5;
    reasons.push(`${recentDnsRecords.length} recent DNS records (+5)`);
  }

  // Penalties
  const isSharedHosting = general.asn && 
    (general.asn.toLowerCase().includes('cloudflare') ||
     general.asn.toLowerCase().includes('amazon') ||
     general.asn.toLowerCase().includes('google'));
  
  if (isSharedHosting && recentPulses.length === 0) {
    score -= 10;
    reasons.push(`Shared hosting without recency (-10)`);
  }

  const oldPulsesOnly = recentPulses.length > 0 && 
    Math.max(...recentPulses) < (now - 365 * 24 * 60 * 60 * 1000);
  
  if (oldPulsesOnly && recentUrls.length === 0 && recentDnsRecords.length === 0) {
    score -= 15;
    reasons.push(`Only old pulses (>1yr) without other signals (-15)`);
  }

  score = Math.max(0, Math.min(100, score));

  let verdict = 'low_confidence';
  if (score >= 70) verdict = 'malicious';
  else if (score >= 50) verdict = 'suspicious';

  return { score, verdict, reasons };
}

async function fetchOTXData(indicator: string, kind: string): Promise<any> {
  const type = kind === 'ipv4' ? 'IPv4' : 'domain';
  const baseUrl = `${OTX_BASE_URL}/indicators/${type}/${indicator}`;
  
  const endpoints = [
    { name: 'general', url: `${baseUrl}/general` },
    { name: 'passive_dns', url: `${baseUrl}/passive_dns` },
    { name: 'url_list', url: `${baseUrl}/url_list` }
  ];

  const results: any = {};

  for (const endpoint of endpoints) {
    const logId = await logNetworkCall(
      SUPABASE_URL,
      SUPABASE_SERVICE_KEY,
      {
        call_type: 'api_call',
        target_url: endpoint.url,
        target_name: `OTX ${endpoint.name}`,
        method: 'GET',
        edge_function_name: 'otx-validator'
      }
    );

    try {
      const startTime = Date.now();
      const response = await fetch(endpoint.url, {
        headers: { 'X-OTX-API-KEY': OTX_API_KEY! }
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      results[endpoint.name] = data;

      if (logId) {
        await updateNetworkLog(
          SUPABASE_URL,
          SUPABASE_SERVICE_KEY,
          logId,
          {
            status: 'completed',
            status_code: response.status,
            response_time_ms: responseTime
          }
        );
      }

      await sleep(RATE_LIMIT_MS);
    } catch (error: any) {
      if (logId) {
        await updateNetworkLog(
          SUPABASE_URL,
          SUPABASE_SERVICE_KEY,
          logId,
          {
            status: 'failed',
            error_message: error.message
          }
        );
      }
      throw error;
    }
  }

  return results;
}

async function processIndicators() {
  console.log('🔍 OTX Validator: Starting validation process');

  // Get indicators that need OTX validation (not yet checked or TTL expired)
  const indicators = await supabaseQuery(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    'dynamic_raw_indicators',
    'GET',
    null,
    '?select=indicator,kind&or=(otx_checked.eq.false,otx_checked.is.null)&limit=100'
  );

  if (!indicators || indicators.length === 0) {
    console.log('✅ No indicators to validate');
    return { validated: 0, cached: 0 };
  }

  console.log(`📋 Found ${indicators.length} indicators to validate`);

  let validated = 0;
  let cached = 0;

  for (const ind of indicators) {
    const { indicator, kind } = ind;

    // Check cache first (TTL validation)
    const cacheCheck = await supabaseQuery(
      SUPABASE_URL,
      SUPABASE_SERVICE_KEY,
      'otx_enrichment',
      'GET',
      null,
      `?indicator=eq.${encodeURIComponent(indicator)}&kind=eq.${kind}&select=*`
    );

    const cached_item = cacheCheck?.[0];
    const needsRefresh = !cached_item || 
      ((Date.now() - new Date(cached_item.refreshed_at).getTime()) / 1000) > cached_item.ttl_seconds;

    let enrichment: any = null;

    if (needsRefresh) {
      console.log(`🔄 Fetching OTX data for ${indicator} (${kind})`);
      
      try {
        const otxData = await fetchOTXData(indicator, kind);
        const general = otxData.general as OTXGeneralResponse;
        const scoring = calculateScore(general, otxData.passive_dns, otxData.url_list);

        const allTags = (general.pulse_info?.pulses || [])
          .flatMap(p => p.tags || [])
          .filter((v, i, a) => a.indexOf(v) === i);

        const allAuthors = new Set(
          (general.pulse_info?.pulses || []).map(p => p.author.username)
        ).size;

        const latestPulse = (general.pulse_info?.pulses || [])
          .map(p => new Date(p.modified || p.created))
          .sort((a, b) => b.getTime() - a.getTime())[0];

        enrichment = {
          indicator,
          kind,
          score: scoring.score,
          verdict: scoring.verdict,
          pulses_count: general.pulse_info?.count || 0,
          authors_count: allAuthors,
          latest_pulse: latestPulse ? latestPulse.toISOString() : null,
          country: general.country_code || null,
          asn: general.asn || null,
          tags: allTags,
          reasons: scoring.reasons,
          raw_otx: otxData,
          // NEW: Store more comprehensive data
          pulse_info: general.pulse_info || null,
          passive_dns: otxData.passive_dns || null,
          url_list: otxData.url_list || null,
          refreshed_at: new Date().toISOString(),
          ttl_seconds: 86400
        };

        await supabaseUpsert(
          SUPABASE_URL,
          SUPABASE_SERVICE_KEY,
          'otx_enrichment',
          [enrichment]
        );

        validated++;
      } catch (error: any) {
        console.error(`❌ Error fetching OTX data for ${indicator}:`, error.message);
        continue;
      }
    } else {
      console.log(`✅ Using cached OTX data for ${indicator}`);
      enrichment = cached_item;
      cached++;
    }

    // Update dynamic_raw_indicators
    if (enrichment) {
      await supabaseQuery(
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY,
        'dynamic_raw_indicators',
        'PATCH',
        {
          otx_checked: true,
          otx_score: enrichment.score,
          otx_verdict: enrichment.verdict,
          confidence: enrichment.score >= 70 
            ? Math.min(100, (ind.confidence || 50) + 20) 
            : Math.max(0, (ind.confidence || 50) - 10)
        },
        `?indicator=eq.${encodeURIComponent(indicator)}&kind=eq.${kind}`
      );
    }
  }

  console.log(`✅ OTX validation completed: ${validated} validated, ${cached} from cache`);
  return { validated, cached, total: indicators.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Allow both CRON secret (for automated calls) and JWT auth (for manual UI calls)
    const cronSecret = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('Authorization');
    
    // Check CRON secret first (for automated calls)
    const isCronAuthenticated = cronSecret === CRON_SECRET;
    
    // Check JWT auth for manual UI calls
    let isUserAuthenticated = false;
    if (!isCronAuthenticated && authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        isUserAuthenticated = !error && !!user;
      } catch (error) {
        console.error('JWT verification error:', error);
      }
    }
    
    if (!isCronAuthenticated && !isUserAuthenticated) {
      console.error('❌ Invalid or missing CRON secret / JWT authentication');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = await processIndicators();

    return new Response(
      JSON.stringify({
        success: true,
        message: `OTX validation completed`,
        ...results
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('❌ OTX Validator error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
