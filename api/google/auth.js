// Admin-only: generate Google OAuth 2.0 authorization URL with state validation.
// Scopes: youtube.readonly + yt-analytics.readonly + webmasters.readonly
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'
import { requireRole } from '../_lib/requireRole.js'

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
].join(' ')

export default async function handler(req, res) {
  const auth = await requireRole(req, ['admin'])
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID tai GOOGLE_REDIRECT_URI puuttuu ympäristömuuttujista' })
  }

  const state = randomUUID()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const { error: stateErr } = await supabaseAdmin.from('google_oauth_state')
    .insert({ state, expires_at: expiresAt })
  if (stateErr) return res.status(500).json({ error: `State insert failed: ${stateErr.message}` })

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)
  url.searchParams.set('login_hint', 'info@kuntomo.fi')

  return res.status(200).json({ url: url.toString() })
}
