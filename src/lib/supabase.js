import { createClient } from '@supabase/supabase-js'

// VAIN publishable-avain client-koodissa. Secret-avain asuu palvelin-
// puolella (Vercel-serverless / api/*), ei koskaan bundlessa.
// Publishable key on Supabasen uusi safe-in-browser -avain — korvaa vanhan
// anon-JWT:n ja on immuuni JWT-secretin rotaatiolle.
const SUPA_URL = 'https://ogboigmanmeepaoqepil.supabase.co'
const SUPA_ANON = 'sb_publishable_KWnucLKngT7HKeyVYzDunQ_pTt0iWP6'

export const supabase = createClient(SUPA_URL, SUPA_ANON)
export { SUPA_URL, SUPA_ANON }
