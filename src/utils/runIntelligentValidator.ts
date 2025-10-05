import { supabase } from '@/integrations/supabase/client';

export async function runIntelligentValidator() {
  try {
    console.log('🚀 Invoking intelligent-validator...');
    
    const { data, error } = await supabase.functions.invoke('intelligent-validator', {
      body: {
        timestamp: new Date().toISOString(),
        triggered_by: 'manual'
      }
    });

    if (error) {
      console.error('❌ Error invoking intelligent-validator:', error);
      throw error;
    }

    console.log('✅ Intelligent validator completed:', data);
    return data;
  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  }
}
