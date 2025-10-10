import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

interface Source {
  name: string;
  file: string;
  kind: 'ipv4' | 'domain';
  priority: number;
}

// 18 drb-ra C2IntelFeeds sources
const SOURCES: Source[] = [
  // Gruppo A: IP C2 (Priority 95)
  { name: 'DRB-RA - IP C2 Full', file: 'IPC2s.csv', kind: 'ipv4', priority: 95 },
  { name: 'DRB-RA - IP C2 30day', file: 'IPC2s-30day.csv', kind: 'ipv4', priority: 95 },
  
  // Gruppo B: IP:Port C2 (Priority 90)
  { name: 'DRB-RA - IPPort C2 Full', file: 'IPPortC2s.csv', kind: 'ipv4', priority: 90 },
  { name: 'DRB-RA - IPPort C2 30day', file: 'IPPortC2s-30day.csv', kind: 'ipv4', priority: 90 },
  
  // Gruppo C: Domini C2 (Priority 95)
  { name: 'DRB-RA - Domain C2 Full', file: 'domainC2s.csv', kind: 'domain', priority: 95 },
  { name: 'DRB-RA - Domain C2 30day', file: 'domainC2s-30day.csv', kind: 'domain', priority: 95 },
  { name: 'DRB-RA - Domain C2 Filtered', file: 'domainC2s-filter-abused.csv', kind: 'domain', priority: 95 },
  { name: 'DRB-RA - Domain C2 30day Filtered', file: 'domainC2s-30day-filter-abused.csv', kind: 'domain', priority: 95 },
  
  // Gruppo D: DNS C2 Domini (Priority 90)
  { name: 'DRB-RA - DNS C2 Domains Full', file: 'DNSC2Domains.csv', kind: 'domain', priority: 90 },
  { name: 'DRB-RA - DNS C2 Domains 30day', file: 'DNSC2Domains-30day.csv', kind: 'domain', priority: 90 },
  
  // Gruppo E: Domini C2 con URL (Priority 92)
  { name: 'DRB-RA - Domain C2 URL Full', file: 'domainC2swithURL.csv', kind: 'domain', priority: 92 },
  { name: 'DRB-RA - Domain C2 URL 30day', file: 'domainC2swithURL-30day.csv', kind: 'domain', priority: 92 },
  { name: 'DRB-RA - Domain C2 URL Filtered', file: 'domainC2swithURL-filter-abused.csv', kind: 'domain', priority: 92 },
  { name: 'DRB-RA - Domain C2 URL 30day Filtered', file: 'domainC2swithURL-30day-filter-abused.csv', kind: 'domain', priority: 92 },
  
  // Gruppo F: Domini C2 con URL+IP (Priority 93)
  { name: 'DRB-RA - Domain C2 URL IP Full', file: 'domainC2swithURLwithIP.csv', kind: 'domain', priority: 93 },
  { name: 'DRB-RA - Domain C2 URL IP 30day', file: 'domainC2swithURLwithIP-30day.csv', kind: 'domain', priority: 93 },
  { name: 'DRB-RA - Domain C2 URL IP Filtered', file: 'domainC2swithURLwithIP-filter-abused.csv', kind: 'domain', priority: 93 },
  { name: 'DRB-RA - Domain C2 URL IP 30day Filtered', file: 'domainC2swithURLwithIP-30day-filter-abused.csv', kind: 'domain', priority: 93 },
];

// Validate IPv4
function isValidIPv4(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;
  
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

// Validate domain
function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  
  // Remove protocol if present
  domain = domain.replace(/^https?:\/\//i, '');
  // Remove path if present
  domain = domain.split('/')[0];
  // Remove port if present
  domain = domain.split(':')[0];
  
  const domainRegex = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

// Extract hostname from URL
function extractHostname(url: string): string {
  try {
    url = url.replace(/^https?:\/\//i, '');
    const hostname = url.split('/')[0].split(':')[0];
    return hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// Parse CSV and extract indicators
function parseCSV(text: string, kind: 'ipv4' | 'domain'): string[] {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return [];
  
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  console.log(`CSV headers: ${headers.join(', ')}`);
  
  // Find relevant column index
  let indicatorIdx = 0;
  if (kind === 'ipv4') {
    indicatorIdx = headers.findIndex(h => h.includes('ip')) ?? 0;
  } else {
    indicatorIdx = headers.findIndex(h => h.includes('domain') || h.includes('url') || h.includes('host')) ?? 0;
  }
  
  const indicators = new Set<string>();
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    
    const columns = line.split(',').map(c => c.trim());
    const value = columns[indicatorIdx];
    
    if (!value) continue;
    
    if (kind === 'ipv4') {
      // Handle IP:Port format - extract just IP
      const ip = value.split(':')[0];
      if (isValidIPv4(ip)) {
        indicators.add(ip);
      }
    } else {
      // Extract hostname from URL or domain
      const hostname = extractHostname(value);
      if (isValidDomain(hostname)) {
        indicators.add(hostname);
      }
    }
  }
  
  return Array.from(indicators);
}

// Batch upsert indicators
async function upsertBatch(
  supabase: any,
  indicators: string[],
  source: Source
): Promise<void> {
  const BATCH_SIZE = 1000;
  const now = new Date().toISOString();
  
  for (let i = 0; i < indicators.length; i += BATCH_SIZE) {
    const batch = indicators.slice(i, i + BATCH_SIZE);
    const records = batch.map(indicator => ({
      indicator,
      kind: source.kind,
      source: source.name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_'),
      first_seen: now,
      last_seen: now,
    }));
    
    const { error } = await supabase
      .from('raw_indicators')
      .upsert(records, {
        onConflict: 'indicator,kind,source',
        ignoreDuplicates: false,
      });
    
    if (error) {
      console.error(`Batch upsert error (${i}-${i + batch.length}):`, error);
      throw error;
    }
  }
}

// Process single source
async function processSource(
  supabase: any,
  source: Source
): Promise<{ success: boolean; indicators: number; error?: string }> {
  const startTime = Date.now();
  const url = `https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/${source.file}`;
  
  console.log(`[${source.name}] Fetching from ${url}`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    console.log(`[${source.name}] Downloaded ${text.length} bytes`);
    
    const indicators = parseCSV(text, source.kind);
    console.log(`[${source.name}] Parsed ${indicators.length} unique ${source.kind} indicators`);
    
    if (indicators.length > 0) {
      await upsertBatch(supabase, indicators, source);
    }
    
    // Update ingest_sources
    const duration = Date.now() - startTime;
    await supabase
      .from('ingest_sources')
      .update({
        last_run: new Date().toISOString(),
        last_success: new Date().toISOString(),
        indicators_count: indicators.length,
        last_error: null,
      })
      .eq('name', source.name);
    
    console.log(`[${source.name}] ✅ Completed in ${duration}ms - ${indicators.length} indicators`);
    
    return { success: true, indicators: indicators.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${source.name}] ❌ Error:`, errorMsg);
    
    // Update error in ingest_sources
    await supabase
      .from('ingest_sources')
      .update({
        last_run: new Date().toISOString(),
        last_error: errorMsg,
      })
      .eq('name', source.name);
    
    return { success: false, indicators: 0, error: errorMsg };
  }
}

// Process sources in batches with rate limiting
async function processBatch(
  supabase: any,
  sources: Source[],
  batchSize: number
): Promise<any[]> {
  const results = [];
  
  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(sources.length / batchSize)} (${batch.length} sources)`);
    
    const batchResults = await Promise.allSettled(
      batch.map(source => processSource(supabase, source))
    );
    
    results.push(...batchResults);
    
    // Small delay between batches
    if (i + batchSize < sources.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    if (CRON_SECRET && cronSecret !== CRON_SECRET) {
      console.error('Invalid cron secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 Starting drb-ra C2IntelFeeds sync - 18 sources');
    const overallStart = Date.now();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Process sources in batches of 10 concurrent
    const results = await processBatch(supabase, SOURCES, 10);

    // Calculate statistics
    const stats = {
      total: results.length,
      successful: 0,
      failed: 0,
      totalIndicators: 0,
      byKind: { ipv4: 0, domain: 0 },
      errors: [] as string[],
    };

    results.forEach((result, idx) => {
      const source = SOURCES[idx];
      if (result.status === 'fulfilled' && result.value.success) {
        stats.successful++;
        stats.totalIndicators += result.value.indicators;
        if (source.kind === 'ipv4') {
          stats.byKind.ipv4 += result.value.indicators;
        } else {
          stats.byKind.domain += result.value.indicators;
        }
      } else {
        stats.failed++;
        const error = result.status === 'rejected' ? result.reason : result.value.error;
        stats.errors.push(`${source.name}: ${error}`);
      }
    });

    const duration = Date.now() - overallStart;
    console.log('\n✅ DRB-RA C2IntelFeeds sync completed');
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`📊 Results: ${stats.successful}/${stats.total} sources successful`);
    console.log(`📈 Indicators: ${stats.totalIndicators.toLocaleString()} total (${stats.byKind.ipv4.toLocaleString()} IPs, ${stats.byKind.domain.toLocaleString()} domains)`);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        duration_ms: duration,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
