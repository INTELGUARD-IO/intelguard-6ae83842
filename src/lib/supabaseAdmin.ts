// Server-side Supabase client with SERVICE_ROLE_KEY
// ONLY use this in Edge Functions, NEVER in client code!
// This file is meant to be copied into supabase/functions/ directory
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// @ts-ignore - Deno is only available in Edge Functions runtime
const supabaseUrl = typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL')! : '';
// @ts-ignore - Deno is only available in Edge Functions runtime
const supabaseServiceKey = typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! : '';

// Admin client bypasses RLS - use with extreme caution
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
