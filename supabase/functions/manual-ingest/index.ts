import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation functions
const isIPv4 = (str: string): boolean => {
  const parts = str.split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255 && part === num.toString();
  });
};

const isDomain = (str: string): boolean => {
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
  return domainRegex.test(str);
};

interface UploadResult {
  success: boolean;
  added: number;
  duplicates: number;
  errors: number;
  errorDetails: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: memberData, error: roleError } = await supabase
      .from('tenant_members')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || memberData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const kind = formData.get('kind') as string;
    const sourceName = formData.get('sourceName') as string;

    if (!file || !kind || !sourceName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file, kind, sourceName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type and size
    if (!file.name.endsWith('.txt')) {
      return new Response(
        JSON.stringify({ error: 'Only .txt files are supported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return new Response(
        JSON.stringify({ error: 'File size exceeds 10MB limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read file content
    const content = await file.text();
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    console.log(`Processing ${lines.length} lines from ${file.name}`);

    const result: UploadResult = {
      success: true,
      added: 0,
      duplicates: 0,
      errors: 0,
      errorDetails: []
    };

    const indicators = new Set<string>();
    const validIndicators: Array<{ indicator: string; kind: string; source: string }> = [];

    // Validate and collect unique indicators
    for (const line of lines) {
      const indicator = line.toLowerCase();

      // Skip comments and empty lines
      if (indicator.startsWith('#') || indicator.startsWith('//')) continue;

      // Validate based on kind
      const isValid = kind === 'ipv4' ? isIPv4(indicator) : isDomain(indicator);

      if (!isValid) {
        result.errors++;
        if (result.errorDetails.length < 10) { // Keep only first 10 errors
          result.errorDetails.push(`Invalid ${kind}: ${indicator}`);
        }
        continue;
      }

      if (indicators.has(indicator)) {
        result.duplicates++;
        continue;
      }

      indicators.add(indicator);
      validIndicators.push({
        indicator,
        kind,
        source: sourceName
      });
    }

    console.log(`Valid indicators: ${validIndicators.length}, Duplicates: ${result.duplicates}, Errors: ${result.errors}`);

    // Insert indicators in batches
    const batchSize = 1000;
    for (let i = 0; i < validIndicators.length; i += batchSize) {
      const batch = validIndicators.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('raw_indicators')
        .upsert(
          batch.map(ind => ({
            ...ind,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString()
          })),
          { 
            onConflict: 'indicator,source',
            ignoreDuplicates: false 
          }
        );

      if (insertError) {
        console.error('Insert error:', insertError);
        result.errorDetails.push(`Batch insert failed: ${insertError.message}`);
        result.success = false;
      } else {
        result.added += batch.length;
      }
    }

    console.log(`Upload complete: ${result.added} added, ${result.duplicates} duplicates, ${result.errors} errors`);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Manual ingest error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
