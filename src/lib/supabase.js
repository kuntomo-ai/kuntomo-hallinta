import { createClient } from '@supabase/supabase-js'

const SUPA_URL = 'https://ogboigmanmeepaoqepil.supabase.co'
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nYm9pZ21hbm1lZXBhb3FlcGlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODI0NDgsImV4cCI6MjA5MzE1ODQ0OH0.f9prm3J0u66QU4vjMqvNWC0g8bev-i2plRlxiEXNp44'
const SUPA_SVC  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nYm9pZ21hbm1lZXBhb3FlcGlsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU4MjQ0OCwiZXhwIjoyMDkzMTU4NDQ4fQ.JDyVF2eOcUpmmwpMt1Vb5hLgYH6T4wj0ik3s0DmWHJo'

export const supabase = createClient(SUPA_URL, SUPA_ANON)
export const supabaseAdmin = createClient(SUPA_URL, SUPA_SVC)
export { SUPA_URL, SUPA_ANON, SUPA_SVC }
