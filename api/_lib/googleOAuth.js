// Shared Google OAuth token management.
// Reads and auto-refreshes access tokens stored in Supabase (google_oauth_tokens).
// GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are env vars; tokens are in the DB.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REFRESH_BUFFER_MS = 5 * 60 * 1000  // refresh 5 min before expiry

export async function getGoogleToken() {
  const { data, error } = await supabaseAdmin
    .from('google_oauth_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Token read failed: ${error.message}`)
  if (!data) throw new Error('Google ei ole yhdistetty. Siirry SOME-sivulle ja yhdistä Google OAuth.')

  const expiresAt = new Date(data.expires_at).getTime()
  if (Date.now() + REFRESH_BUFFER_MS < expiresAt) {
    return data.access_token
  }

  return refreshAccessToken(data)
}

async function refreshAccessToken(record) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID tai GOOGLE_CLIENT_SECRET puuttuu ympäristömuuttujista')
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: record.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Token refresh epäonnistui: ${JSON.stringify(data)}`)

  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString()
  const { error } = await supabaseAdmin.from('google_oauth_tokens')
    .update({ access_token: data.access_token, expires_at: expiresAt })
    .eq('id', record.id)
  if (error) throw new Error(`Token update failed: ${error.message}`)

  return data.access_token
}
