import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('🚀 AUTO-START: Avvio pipeline di validazione domini...');

    // Invoke trigger-domain-validation
    const { data, error } = await supabase.functions.invoke('trigger-domain-validation', {
      body: { 
        timestamp: new Date().toISOString(),
        triggered_by: 'auto_start'
      }
    });

    if (error) {
      console.error('❌ Errore nell\'avvio della validazione:', error);
      throw error;
    }

    console.log('✅ Pipeline di validazione avviata con successo');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Domain validation pipeline started',
        data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
