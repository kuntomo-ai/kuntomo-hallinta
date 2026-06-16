import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.SUPABASE_URL
const SUPA_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPA_URL || !SUPA_SVC) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env')
}

export const supabaseAdmin = createClient(SUPA_URL, SUPA_SVC, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})
