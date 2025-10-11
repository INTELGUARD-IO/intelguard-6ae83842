import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { indicator, kind } = await req.json();

    if (!indicator || !kind) {
      return new Response(
        JSON.stringify({ error: 'indicator and kind are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cfApiToken = Deno.env.get('CLOUDFLARE_URLSCAN_API_KEY');
    const cfAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    if (!cfApiToken || !cfAccountId) {
      return new Response(
        JSON.stringify({ 
          error: 'Cloudflare credentials not configured',
          details: {
            hasToken: !!cfApiToken,
            hasAccountId: !!cfAccountId,
            message: 'CLOUDFLARE_URLSCAN_API_KEY e CLOUDFLARE_ACCOUNT_ID devono essere configurati'
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Testing scan for ${kind}: ${indicator}`);
    console.log(`📋 Account ID: ${cfAccountId}`);

    // Prepare scan URL with EXPLICIT schema (http:// or https://)
    const scanTargetUrl = kind === 'ipv4' 
      ? `http://${indicator}` 
      : `https://${indicator}`;

    // Use URL Scanner v2 API endpoint
    const scanUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/urlscanner/v2/scan`;
    
    console.log(`📤 Submitting scan to: ${scanUrl}`);
    console.log(`🎯 Target URL: ${scanTargetUrl}`);

    // Submit scan
    const scanResponse = await fetch(scanUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: scanTargetUrl,
        visibility: 'unlisted',
        customHeaders: {},
      }),
    });

    const responseText = await scanResponse.text();
    console.log(`📡 Response Status: ${scanResponse.status}`);
    console.log(`📡 Response Body: ${responseText}`);

    if (!scanResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cloudflare API error',
          status: scanResponse.status,
          statusText: scanResponse.statusText,
          response: responseText,
          headers: Object.fromEntries(scanResponse.headers.entries()),
          requestUrl: scanUrl,
          targetUrl: scanTargetUrl
        }),
        { 
          status: scanResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const scanData = JSON.parse(responseText);
    const scanUuid = scanData.result?.uuid;

    if (!scanUuid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No scan UUID returned',
          response: scanData
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Scan submitted! UUID: ${scanUuid}`);

    // Poll for results (max 8 attempts = 24 seconds)
    let result = null;
    const maxAttempts = 8;
    const pollDelay = 3000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      console.log(`⏳ Polling attempt ${attempt + 1}/${maxAttempts}...`);
      await new Promise(resolve => setTimeout(resolve, pollDelay));

      const resultUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/urlscanner/scan/${scanUuid}`;
      const resultResponse = await fetch(resultUrl, {
        headers: {
          'Authorization': `Bearer ${cfApiToken}`,
        },
      });

      if (resultResponse.ok) {
        const resultData = await resultResponse.json();
        
        if (resultData.result?.task?.success) {
          result = resultData.result;
          console.log(`✅ Scan completed!`);
          break;
        } else if (resultData.result?.status === 'failed') {
          console.error(`❌ Scan failed`);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Scan failed',
              result: resultData.result
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    if (!result) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Scan timeout - results not ready after 24 seconds',
          scanUuid
        }),
        { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze results
    const summary = result.scan?.summary;
    const malicious = summary?.malicious || false;
    const categories = summary?.categories || [];
    const verdict = summary?.verdict || 'clean';

    // Calculate score
    let score = 0;
    if (malicious) {
      score = 85;
      if (categories.includes('Phishing')) score = Math.min(100, score + 15);
      if (categories.includes('Malware')) score = Math.min(100, score + 15);
    }

    return new Response(
      JSON.stringify({
        success: true,
        indicator,
        kind,
        scanUuid,
        verdict,
        malicious,
        score,
        categories,
        effectiveUrl: result.task?.effectiveUrl,
        screenshot: result.task?.screenshot,
        technologies: result.scan?.technologies || [],
        fullResult: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
