import { supabaseAdmin } from '../../lib/supabaseAdmin.js'
import { refreshToken, isTokenError } from '../../lib/instagram.js'
import { requireCron } from '../_lib/auth.js'

const REFRESH_WINDOW_DAYS = 14

export default async function handler(req, res) {
  if (!requireCron(req, res)) return

  const cutoff = new Date(Date.now() + REFRESH_WINDOW_DAYS * 86400e3).toISOString()
  const { data: tokens, error } = await supabaseAdmin
    .from('ig_tokens')
    .select('account_id, access_token, expires_at')
    .lte('expires_at', cutoff)
  if (error) return res.status(500).json({ error: error.message })

  const out = { checked: tokens?.length || 0, refreshed: [], errors: [] }

  for (const t of tokens || []) {
    try {
      const r = await refreshToken(t.access_token)
      const newExpiresAt = new Date(Date.now() + Number(r.expires_in || 0) * 1000).toISOString()
      const { error: upErr } = await supabaseAdmin
        .from('ig_tokens')
        .update({
          access_token: r.access_token,
          expires_at: newExpiresAt,
          last_refreshed_at: new Date().toISOString(),
        })
        .eq('account_id', t.account_id)
      if (upErr) {
        out.errors.push(`db update ${t.account_id}: ${upErr.message}`)
      } else {
        out.refreshed.push({ account_id: t.account_id, expires_at: newExpiresAt })
      }
    } catch (e) {
      const tag = isTokenError(e) ? 'TOKEN_ERROR' : 'ERROR'
      out.errors.push(`${tag} ${t.account_id}: ${e.message}`)
    }
  }

  res.status(200).json(out)
}
