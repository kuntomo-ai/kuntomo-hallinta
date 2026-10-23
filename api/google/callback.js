// Google OAuth 2.0 callback: exchange code → tokens, discover channels & properties.
// Validates state, stores tokens in google_oauth_tokens (no RLS, service role only).
// Auto-discovers YouTube channels (mine=true) and GSC properties, upserts them.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const YT_BASE = 'https://www.googleapis.com/youtube/v3'
const GSC_BASE = 'https://searchconsole.googleapis.com/webmasters/v3'

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query
  const frontendBase = process.env.FRONTEND_URL || 'https://hallinta.kuntomo.fi'

  if (oauthError) {
    return res.redirect(302, `${frontendBase}/some?google_error=${encodeURIComponent(oauthError)}`)
  }

  // Validate state
  if (!state) {
    return res.redirect(302, `${frontendBase}/some?google_error=missing_state`)
  }
  const { data: stateRow, error: stateErr } = await supabaseAdmin
    .from('google_oauth_state')
    .select('*')
    .eq('state', state)
    .maybeSingle()
  if (stateErr || !stateRow) {
    return res.redirect(302, `${frontendBase}/some?google_error=invalid_state`)
  }
  if (new Date(stateRow.expires_at) < new Date()) {
    await supabaseAdmin.from('google_oauth_state').delete().eq('state', state)
    return res.redirect(302, `${frontendBase}/some?google_error=state_expired`)
  }
  await supabaseAdmin.from('google_oauth_state').delete().eq('state', state)

  // Exchange code for tokens
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return res.redirect(302, `${frontendBase}/some?google_error=missing_server_config`)
  }

  let tokens
  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })
    tokens = await tokenRes.json()
  } catch {
    return res.redirect(302, `${frontendBase}/some?google_error=token_request_failed`)
  }

  if (!tokens.access_token || !tokens.refresh_token) {
    return res.redirect(302, `${frontendBase}/some?google_error=token_exchange_failed`)
  }

  // Verify all required scopes were granted
  const REQUIRED_SCOPES = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/webmasters.readonly',
  ]
  const grantedScopes = (tokens.scope || '').split(' ')
  const missingScopes = REQUIRED_SCOPES.filter(s => !grantedScopes.includes(s))
  if (missingScopes.length > 0) {
    return res.redirect(302, `${frontendBase}/some?google_error=missing_scopes`)
  }

  // Verify the authorized account matches the configured integration account (mandatory)
  const PERMITTED_EMAIL = (process.env.GOOGLE_PERMITTED_EMAIL || 'info@kuntomo.fi').toLowerCase()
  let verifiedEmail
  try {
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    })
    if (!infoRes.ok) {
      return res.redirect(302, `${frontendBase}/some?google_error=userinfo_failed`)
    }
    const info = await infoRes.json()
    if (!info.email || !info.verified_email) {
      return res.redirect(302, `${frontendBase}/some?google_error=email_unverified`)
    }
    if (info.email.toLowerCase() !== PERMITTED_EMAIL) {
      return res.redirect(302, `${frontendBase}/some?google_error=wrong_account`)
    }
    verifiedEmail = info.email
  } catch {
    return res.redirect(302, `${frontendBase}/some?google_error=userinfo_exception`)
  }

  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()
  const { error: saveErr } = await supabaseAdmin.from('google_oauth_tokens').upsert({
    email: verifiedEmail,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    scopes: tokens.scope || null,
  }, { onConflict: 'email' })
  if (saveErr) {
    return res.redirect(302, `${frontendBase}/some?google_error=token_save_failed`)
  }

  // Auto-discover YouTube channels (non-fatal)
  try {
    const ytRes = await fetch(`${YT_BASE}/channels?part=snippet,statistics&mine=true&maxResults=50`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    })
    if (ytRes.ok) {
      const ytData = await ytRes.json()
      for (const item of ytData.items || []) {
        await supabaseAdmin.from('yt_channels').upsert({
          channel_id: item.id,
          title: item.snippet?.title || null,
          handle: item.snippet?.customUrl || null,
          is_active: true,
        }, { onConflict: 'channel_id' })
      }
    }
  } catch { /* non-fatal */ }

  // Auto-discover GSC properties (non-fatal)
  try {
    const gscRes = await fetch(`${GSC_BASE}/sites`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    })
    if (gscRes.ok) {
      const gscData = await gscRes.json()
      const allowed = new Set(['siteOwner', 'siteFullUser', 'siteRestrictedUser'])
      for (const site of gscData.siteEntry || []) {
        if (!allowed.has(site.permissionLevel)) continue
        await supabaseAdmin.from('gsc_properties').upsert({
          site_url: site.siteUrl,
          display_name: site.siteUrl,
          is_active: true,
        }, { onConflict: 'site_url' })
      }
    }
  } catch { /* non-fatal */ }

  return res.redirect(302, `${frontendBase}/some?google=connected`)
}
