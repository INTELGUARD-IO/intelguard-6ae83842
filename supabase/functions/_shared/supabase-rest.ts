// Shared Supabase REST API helper to avoid problematic client library imports
export const supabaseQuery = async (
  url: string,
  serviceKey: string,
  table: string,
  method: string = 'GET',
  body?: any,
  query?: string
) => {
  const endpoint = `${url}/rest/v1/${table}${query || ''}`;
  const headers: Record<string, string> = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(endpoint, options);
  
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Supabase REST error (${response.status}): ${errorData}`);
  }

  // Handle empty responses for DELETE/PATCH operations
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }
  
  return null;
};

export const supabaseRPC = async (
  url: string,
  serviceKey: string,
  functionName: string,
  params?: Record<string, any>
) => {
  const endpoint = `${url}/rest/v1/rpc/${functionName}`;
  const headers: Record<string, string> = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(params || {}),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Supabase RPC error (${response.status}): ${errorData}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }
  
  return null;
};

// Upsert helper that properly handles batch inserts with ON CONFLICT
export const supabaseUpsert = async (
  url: string,
  serviceKey: string,
  table: string,
  data: any[],
  conflictColumns?: string[]
) => {
  const endpoint = `${url}/rest/v1/${table}`;
  const headers: Record<string, string> = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal'
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Supabase UPSERT error (${response.status}): ${errorData}`);
  }

  return response.status;
};
