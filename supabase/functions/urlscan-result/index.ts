import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const uuid = url.searchParams.get('uuid');

    if (!uuid) {
      return new Response(
        JSON.stringify({ error: 'uuid parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cfApiToken = Deno.env.get('CLOUDFLARE_URLSCAN_API_KEY');
    const cfAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    if (!cfApiToken || !cfAccountId) {
      return new Response(
        JSON.stringify({ 
          error: 'Cloudflare credentials not configured'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Fetching result for UUID: ${uuid}`);

    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/urlscanner/v2/result/${uuid}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${cfApiToken}`,
      },
    });

    const responseText = await response.text();
    console.log(`📡 Response Status: ${response.status}`);

    if (!response.ok) {
      console.error(`❌ API Error: ${responseText}`);
      return new Response(
        JSON.stringify({
          error: 'Cloudflare API error',
          status: response.status,
          details: responseText
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(responseText);
    
    // Check if scan is complete
    const scanStatus = data.scan?.status;
    
    if (scanStatus === 'FAILED') {
      return new Response(
        JSON.stringify({
          status: 'failed',
          error: 'Scan failed',
          uuid
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (scanStatus !== 'COMPLETE') {
      // Still pending
      return new Response(
        JSON.stringify({
          status: 'pending',
          uuid
        }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Scan complete - return reduced JSON
    const result = {
      status: 'ready',
      uuid,
      final_url: data.page?.url || data.scan?.url,
      verdicts: data.scan?.verdict,
      categories: data.scan?.categories || [],
      page_title: data.page?.title,
      screenshot: data.scan?.screenshot,
      technologies: data.scan?.technologies || [],
      malicious: data.scan?.verdict === 'malicious'
    };

    console.log(`✅ Scan ready: ${result.verdicts}`);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
