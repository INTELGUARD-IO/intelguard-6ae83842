import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidatorVote {
  name: string;
  vote: 'malicious' | 'clean' | 'unknown';
  score?: number;
  reason?: string;
}

// TLD sospetti comuni
const SUSPICIOUS_TLDS = [
  '.tk', '.ml', '.ga', '.cf', '.gq', // Free TLDs
  '.top', '.xyz', '.work', '.click', '.link', '.download', '.win',
  '.bid', '.stream', '.loan', '.racing', '.accountant', '.science',
  '.party', '.review', '.trade', '.webcam', '.date', '.faith'
];

// Calcola uno score avanzato per un indicatore
function calculateAdvancedScore(indicator: any, votes: ValidatorVote[]): number {
  let score = 0;
  
  // Base score from validators (0-70 points)
  const maliciousVotes = votes.filter(v => v.vote === 'malicious').length;
  const totalVotes = votes.length;
  if (totalVotes > 0) {
    score += (maliciousVotes / totalVotes) * 70;
  }
  
  // Confidence penalty/bonus (-10 to +10 points)
  if (indicator.confidence < 60) {
    score -= 10;
  } else if (indicator.confidence >= 80) {
    score += 10;
  }
  
  // TLD check for domains (-15 to +5 points)
  if (indicator.kind === 'domain') {
    const hasSuspiciousTLD = SUSPICIOUS_TLDS.some(tld => 
      indicator.indicator.toLowerCase().endsWith(tld)
    );
    
    if (hasSuspiciousTLD) {
      score += 15; // Suspicious TLD increases malicious score
    } else {
      // Common legitimate TLDs (.com, .org, .net, .edu, .gov) bonus
      const legitimateTLDs = ['.com', '.org', '.net', '.edu', '.gov', '.mil'];
      if (legitimateTLDs.some(tld => indicator.indicator.toLowerCase().endsWith(tld))) {
        score -= 5; // Reduce score slightly for legit TLDs
      }
    }
  }
  
  // Whitelist bonus (-20 points)
  if (indicator.whitelisted || indicator.is_trusted) {
    score -= 20;
  }
  
  // Source count bonus (0-10 points)
  if (indicator.source_count >= 5) {
    score += 10;
  } else if (indicator.source_count >= 3) {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, score)); // Clamp 0-100
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[intelligent-validator] 🧠 Starting intelligent validation with advanced scoring...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch indicators with validator results
    console.log('[intelligent-validator] 📊 Fetching indicators with validator results...');
    const { data: indicators, error: fetchError } = await supabase
      .from('dynamic_raw_indicators')
      .select('*')
      .gte('confidence', 50)  // Only process indicators with decent confidence
      .eq('whitelisted', false)  // Exclude whitelisted
      .limit(10000);

    if (fetchError) {
      throw new Error(`Failed to fetch indicators: ${fetchError.message}`);
    }

    if (!indicators || indicators.length === 0) {
      console.log('[intelligent-validator] ✅ No indicators to validate');
      return new Response(
        JSON.stringify({ success: true, promoted: 0, message: 'No indicators to validate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[intelligent-validator] 📋 Analyzing ${indicators.length} indicators...`);

    let promotedIpv4 = 0;
    let promotedDomains = 0;
    let skipped = 0;

    const toPromote: any[] = [];

    for (const indicator of indicators) {
      // CHECK 1: Whitelist trusted domains
      let isTrusted = false;
      if (indicator.kind === 'domain') {
        const { data: trustedDomain } = await supabase
          .from('trusted_domains')
          .select('domain')
          .eq('domain', indicator.indicator)
          .maybeSingle();
        
        if (trustedDomain) {
          isTrusted = true;
          console.log(`[intelligent-validator] 🛡️ TRUSTED: ${indicator.indicator} (in whitelist)`);
          skipped++;
          continue;
        }
      }

      const votes: ValidatorVote[] = [];

      // === VALIDATOR 1: OTX (AlienVault) ===
      if (indicator.otx_checked) {
        if (indicator.otx_score !== null && indicator.otx_score >= 3) {
          votes.push({ name: 'OTX', vote: 'malicious', score: indicator.otx_score, reason: `OTX score: ${indicator.otx_score}` });
        } else if (indicator.otx_verdict === 'malicious') {
          votes.push({ name: 'OTX', vote: 'malicious', reason: 'OTX verdict: malicious' });
        } else {
          votes.push({ name: 'OTX', vote: 'clean' });
        }
      }

      // === VALIDATOR 2: Google Safe Browsing (high priority for domains, weight doppio) ===
      if (indicator.safebrowsing_checked) {
        if (indicator.safebrowsing_verdict && indicator.safebrowsing_verdict !== 'clean') {
          const weight = indicator.kind === 'domain' ? 2 : 1;
          for (let i = 0; i < weight; i++) {
            votes.push({ name: 'SafeBrowsing', vote: 'malicious', reason: `Verdict: ${indicator.safebrowsing_verdict}` });
          }
        } else {
          votes.push({ name: 'SafeBrowsing', vote: 'clean' });
        }
      }

      // === VALIDATOR 3: AbuseIPDB ===
      if (indicator.abuseipdb_checked) {
        if (indicator.abuseipdb_in_blacklist || (indicator.abuseipdb_score !== null && indicator.abuseipdb_score >= 70)) {
          votes.push({ 
            name: 'AbuseIPDB', 
            vote: 'malicious', 
            score: indicator.abuseipdb_score,
            reason: indicator.abuseipdb_in_blacklist ? 'In blacklist' : `Score: ${indicator.abuseipdb_score}`
          });
        } else {
          votes.push({ name: 'AbuseIPDB', vote: 'clean' });
        }
      }

      // === VALIDATOR 4: NeutrinoAPI ===
      if (indicator.neutrinoapi_checked) {
        if (indicator.neutrinoapi_in_blocklist || 
            (indicator.neutrinoapi_host_reputation_score !== null && indicator.neutrinoapi_host_reputation_score <= 30)) {
          votes.push({ 
            name: 'NeutrinoAPI', 
            vote: 'malicious',
            reason: indicator.neutrinoapi_in_blocklist ? 'In blocklist' : `Low reputation: ${indicator.neutrinoapi_host_reputation_score}`
          });
        } else {
          votes.push({ name: 'NeutrinoAPI', vote: 'clean' });
        }
      }

      // === VALIDATOR 5: URLScan (for domains) ===
      if (indicator.urlscan_checked && indicator.kind === 'domain') {
        if (indicator.urlscan_malicious || (indicator.urlscan_score !== null && indicator.urlscan_score >= 70)) {
          votes.push({ 
            name: 'URLScan', 
            vote: 'malicious',
            score: indicator.urlscan_score,
            reason: indicator.urlscan_malicious ? 'Flagged malicious' : `Score: ${indicator.urlscan_score}`
          });
        } else {
          votes.push({ name: 'URLScan', vote: 'clean' });
        }
      }

      // === VALIDATOR 6: HoneyDB (for IPs) ===
      if (indicator.honeydb_checked && indicator.kind === 'ipv4') {
        if (indicator.honeydb_in_blacklist) {
          votes.push({ 
            name: 'HoneyDB', 
            vote: 'malicious',
            score: indicator.honeydb_threat_score,
            reason: 'In HoneyDB blacklist'
          });
        } else {
          votes.push({ name: 'HoneyDB', vote: 'clean' });
        }
      }

      // === VALIDATOR 7: Abuse.ch ===
      if (indicator.abuse_ch_checked) {
        if (indicator.abuse_ch_is_fp === false) {
          votes.push({ name: 'Abuse.ch', vote: 'malicious', reason: 'Confirmed threat (not FP)' });
        } else if (indicator.abuse_ch_is_fp === true) {
          votes.push({ name: 'Abuse.ch', vote: 'clean', reason: 'False positive' });
        }
      }

      // === VALIDATOR 8: VirusTotal ===
      if (indicator.virustotal_checked) {
        if (indicator.virustotal_malicious || (indicator.virustotal_score !== null && indicator.virustotal_score >= 5)) {
          votes.push({ 
            name: 'VirusTotal', 
            vote: 'malicious',
            score: indicator.virustotal_score,
            reason: `${indicator.virustotal_score} engines detected`
          });
        } else {
          votes.push({ name: 'VirusTotal', vote: 'clean' });
        }
      }

      // === VALIDATOR 9: Censys ===
      if (indicator.censys_checked) {
        if (indicator.censys_malicious || (indicator.censys_score !== null && indicator.censys_score >= 70)) {
          votes.push({ 
            name: 'Censys', 
            vote: 'malicious',
            score: indicator.censys_score,
            reason: `Score: ${indicator.censys_score}`
          });
        } else {
          votes.push({ name: 'Censys', vote: 'clean' });
        }
      }

      // === VALIDATOR 10: Cloudflare URL Scanner (for domains, weight doppio) ===
      if (indicator.cloudflare_urlscan_checked && indicator.kind === 'domain') {
        if (indicator.cloudflare_urlscan_malicious || (indicator.cloudflare_urlscan_score !== null && indicator.cloudflare_urlscan_score >= 70)) {
          const weight = 2; // Weight doppio per domini
          for (let i = 0; i < weight; i++) {
            votes.push({ 
              name: 'Cloudflare URLScan', 
              vote: 'malicious',
              score: indicator.cloudflare_urlscan_score,
              reason: indicator.cloudflare_urlscan_categories?.join(', ') || 'Malicious'
            });
          }
        } else {
          votes.push({ name: 'Cloudflare URLScan', vote: 'clean' });
        }
      }

      // === ADVANCED SCORING SYSTEM ===
      const advancedScore = calculateAdvancedScore({ ...indicator, is_trusted: isTrusted }, votes);
      
      // Calculate basic consensus
      const maliciousVotes = votes.filter(v => v.vote === 'malicious').length;
      const totalVotes = votes.length;
      const consensusThreshold = indicator.kind === 'domain' ? 1 : 2; // 1 per domini, 2 per IP

      // Promotion logic con advanced scoring
      const shouldPromote = 
        (maliciousVotes >= consensusThreshold && totalVotes >= 2) || // Standard consensus
        (advancedScore >= 75 && indicator.confidence >= 70); // High advanced score + high confidence

      if (shouldPromote) {
        // PROMOTE TO VALIDATED!
        const validatorNames = votes.filter(v => v.vote === 'malicious').map(v => v.name).join(', ');
        
        console.log(`[intelligent-validator] ✅ PROMOTED: ${indicator.indicator} (${indicator.kind}) - Score: ${advancedScore.toFixed(1)}, Votes: ${maliciousVotes}/${totalVotes} (${validatorNames})`);
        
        // Fetch enrichment data per country/asn
        const { data: enrichment } = await supabase
          .from('enrichment_summary')
          .select('country, asn, asn_name')
          .eq('indicator', indicator.indicator)
          .eq('kind', indicator.kind)
          .maybeSingle();

        toPromote.push({
          indicator: indicator.indicator,
          kind: indicator.kind,
          confidence: indicator.confidence,
          country: enrichment?.country || null,
          asn: enrichment?.asn || null,
          last_validated: new Date().toISOString(),
        });

        if (indicator.kind === 'ipv4') promotedIpv4++;
        else if (indicator.kind === 'domain') promotedDomains++;
      } else {
        skipped++;
        if (advancedScore >= 60 && advancedScore < 75) {
          console.log(`[intelligent-validator] ⚠️ SUSPICIOUS (not promoted): ${indicator.indicator} - Score: ${advancedScore.toFixed(1)} (needs >= 75 or more validators)`);
        } else if (totalVotes > 0 && maliciousVotes === 0) {
          console.log(`[intelligent-validator] ⊘ SKIPPED: ${indicator.indicator} - All ${totalVotes} validators say clean, Score: ${advancedScore.toFixed(1)}`);
        } else if (maliciousVotes < consensusThreshold) {
          console.log(`[intelligent-validator] ⏭️ SKIPPED: ${indicator.indicator} - Only ${maliciousVotes}/${totalVotes} validators agree, Score: ${advancedScore.toFixed(1)} (need ${consensusThreshold} votes or score >= 75)`);
        }
      }

      // Progress logging
      if ((promotedIpv4 + promotedDomains + skipped) % 100 === 0) {
        console.log(`[intelligent-validator] 📊 Progress: ${promotedIpv4 + promotedDomains} promoted, ${skipped} skipped`);
      }
    }

    // Bulk insert promoted indicators
    if (toPromote.length > 0) {
      console.log(`[intelligent-validator] 💾 Inserting ${toPromote.length} validated indicators...`);
      
      const batchSize = 500;
      for (let i = 0; i < toPromote.length; i += batchSize) {
        const batch = toPromote.slice(i, i + batchSize);
        
        const { error: upsertError } = await supabase
          .from('validated_indicators')
          .upsert(batch, { onConflict: 'indicator,kind' });
        
        if (upsertError) {
          console.error(`[intelligent-validator] ❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, upsertError.message);
        } else {
          console.log(`[intelligent-validator] ✅ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toPromote.length / batchSize)} inserted`);
        }
      }
    }

    console.log('[intelligent-validator] 🎉 Validation complete!');
    console.log(`[intelligent-validator] 📈 IPv4 promoted: ${promotedIpv4}`);
    console.log(`[intelligent-validator] 📈 Domains promoted: ${promotedDomains}`);
    console.log(`[intelligent-validator] ⏭️ Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        promoted: promotedIpv4 + promotedDomains,
        breakdown: {
          ipv4: promotedIpv4,
          domains: promotedDomains,
          skipped: skipped,
        },
        message: `Promoted ${promotedIpv4 + promotedDomains} indicators (${promotedIpv4} IPv4, ${promotedDomains} domains)`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[intelligent-validator] ❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});