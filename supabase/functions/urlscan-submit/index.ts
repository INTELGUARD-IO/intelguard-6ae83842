import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { indicator } = await req.json();

    if (!indicator) {
      return new Response(
        JSON.stringify({ error: 'indicator is required' }),
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

    // Add explicit schema if missing (for IPs)
    let scanUrl = indicator;
    if (!/^https?:\/\//i.test(indicator)) {
      // Detect if it's an IP address
      const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(indicator);
      scanUrl = isIP ? `http://${indicator}` : `https://${indicator}`;
    }

    console.log(`📤 Submitting scan for: ${scanUrl}`);

    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/urlscanner/v2/scan`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: scanUrl,
        visibility: 'unlisted',
      }),
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
    const uuid = data.uuid;

    if (!uuid) {
      return new Response(
        JSON.stringify({ error: 'No UUID returned from Cloudflare' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Scan submitted: ${uuid}`);

    return new Response(
      JSON.stringify({
        uuid,
        api: 'cloudflare_urlscan_v2',
        result: 'submitted'
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
