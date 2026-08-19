import { createClient } from '@supabase/supabase-js'

// VAIN anon-avain client-koodissa. Service_role -avain asuu palvelin-
// puolella (Vercel-serverless / api/*), ei koskaan bundlessa.
const SUPA_URL = 'https://ogboigmanmeepaoqepil.supabase.co'
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nYm9pZ21hbm1lZXBhb3FlcGlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODI0NDgsImV4cCI6MjA5MzE1ODQ0OH0.f9prm3J0u66QU4vjMqvNWC0g8bev-i2plRlxiEXNp44'

export const supabase = createClient(SUPA_URL, SUPA_ANON)
export { SUPA_URL, SUPA_ANON }
