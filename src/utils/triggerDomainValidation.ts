import { supabase } from '@/integrations/supabase/client';

export async function triggerDomainValidation() {
  try {
    console.log('🚀 Triggering priority domain validation...');
    
    const { data, error } = await supabase.functions.invoke('trigger-domain-validation', {
      body: { timestamp: new Date().toISOString() }
    });

    if (error) {
      console.error('❌ Error triggering domain validation:', error);
      throw error;
    }

    console.log('✅ Domain validation triggered:', data);
    return data;
  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  }
}
