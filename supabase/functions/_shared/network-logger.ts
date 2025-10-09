// Network activity logger for tracking HTTP calls in real-time
import { supabaseQuery } from './supabase-rest.ts';

export interface NetworkCallParams {
  call_type: 'ingest' | 'validator' | 'api_call';
  target_url: string;
  target_name: string;
  method?: string;
  edge_function_name?: string;
  items_total?: number;
  metadata?: Record<string, any>;
}

export interface NetworkCallUpdate {
  status?: 'active' | 'completed' | 'failed' | 'timeout';
  status_code?: number;
  response_time_ms?: number;
  items_processed?: number;
  error_message?: string;
  bytes_transferred?: number;
}

/**
 * Log the start of a network call
 */
export const logNetworkCall = async (
  url: string,
  serviceKey: string,
  params: NetworkCallParams
): Promise<string | null> => {
  try {
    const body = {
      call_type: params.call_type,
      target_url: params.target_url,
      target_name: params.target_name,
      method: params.method || 'GET',
      edge_function_name: params.edge_function_name,
      items_total: params.items_total,
      metadata: params.metadata || {},
      status: 'active'
    };

    const result = await supabaseQuery(
      url,
      serviceKey,
      'network_activity_log',
      'POST',
      body
    );

    if (result && result.length > 0) {
      return result[0].id;
    }
    return null;
  } catch (error) {
    console.error('Failed to log network call:', error);
    return null;
  }
};

/**
 * Update an existing network call log
 */
export const updateNetworkLog = async (
  url: string,
  serviceKey: string,
  logId: string,
  update: NetworkCallUpdate
): Promise<void> => {
  try {
    const body: any = {
      ...update,
      completed_at: update.status === 'completed' || update.status === 'failed' || update.status === 'timeout' 
        ? new Date().toISOString() 
        : undefined
    };

    await supabaseQuery(
      url,
      serviceKey,
      'network_activity_log',
      'PATCH',
      body,
      `?id=eq.${logId}`
    );
  } catch (error) {
    console.error('Failed to update network log:', error);
  }
};
