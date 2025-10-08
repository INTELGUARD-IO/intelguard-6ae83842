// Re-export supabase client
import { createClient } from "@/lib/supabase/client"

export const supabase = createClient()
