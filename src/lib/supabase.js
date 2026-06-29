import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dqitsleyoxzxdngdwdcq.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zPt7aY2iguBlbYJtg0_8Qw_duBR21b1'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
