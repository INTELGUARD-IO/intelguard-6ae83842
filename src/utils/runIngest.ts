import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export async function runIngestNow() {
  try {
    toast.info('🚀 Avvio ingest immediato...', {
      description: 'Elaborazione fonti mai eseguite'
    });
    
    const { data, error } = await supabase.functions.invoke('ingest', {
      body: {
        timestamp: new Date().toISOString(),
        triggered_by: 'manual_spot_run',
        force: true // Prioritize never-run sources
      }
    });

    if (error) throw error;

    toast.success('✅ Ingest completato!', {
      description: `Elaborate ${data?.sources_processed || 0} fonti`,
      duration: 5000
    });

    return data;
  } catch (error: any) {
    console.error('Errore ingest:', error);
    toast.error('❌ Errore durante ingest', {
      description: error.message || 'Errore sconosciuto'
    });
    throw error;
  }
}
