import { createClient } from '@supabase/supabase-js'

///
///keys go here
///
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
