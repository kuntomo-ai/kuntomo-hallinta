// Admin-only endpoint for managing Supabase Auth users.
// Never call auth.admin.* from the browser — the service_role key must stay server-side.
//
// Actions (POST body { action, ... }):
//   create        { email, first_name?, last_name? }              → { uid }
//   ban           { uid }                                           → { ok }
//   unban         { uid }                                           → { ok }
//   recovery      { email }                                         → { ok }
//   delete        { uid }                                           → { deleted, banned? }
//
// Requires Authorization: Bearer <supabase-user-jwt> with admin|hallitus|manager role.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'
import { requireRole } from '../_lib/requireRole.js'

const BAN_100_YEARS = '876000h'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }
  const auth = await requireRole(req, ['admin', 'hallitus', 'manager'])
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  const { action, uid, email, first_name, last_name } = req.body || {}

  try {
    if (action === 'create') {
      if (!email) return res.status(400).json({ error: 'email required' })
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: String(email).trim(),
        email_confirm: true,
        user_metadata: { first_name, last_name },
      })
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ uid: data?.user?.id ?? null })
    }

    if (action === 'ban') {
      if (!uid) return res.status(400).json({ error: 'uid required' })
      const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, { ban_duration: BAN_100_YEARS })
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    if (action === 'unban') {
      if (!uid) return res.status(400).json({ error: 'uid required' })
      const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, { ban_duration: 'none' })
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    if (action === 'recovery') {
      if (!email) return res.status(400).json({ error: 'email required' })
      const { error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: String(email).trim(),
      })
      // Recovery links are best-effort; ignore some errors (already-sent throttling)
      if (error && !String(error.message).toLowerCase().includes('rate')) {
        return res.status(400).json({ error: error.message })
      }
      return res.status(200).json({ ok: true })
    }

    if (action === 'delete') {
      if (!uid) return res.status(400).json({ error: 'uid required' })
      const { error } = await supabaseAdmin.auth.admin.deleteUser(uid)
      if (error) {
        // Fallback: ban permanently + rename email so re-creation is possible
        const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(uid, {
          ban_duration: BAN_100_YEARS,
          email: `deleted_${Date.now()}@poistettu.invalid`,
        })
        if (banErr) return res.status(400).json({ error: banErr.message })
        return res.status(200).json({ deleted: false, banned: true })
      }
      return res.status(200).json({ deleted: true })
    }

    return res.status(400).json({ error: 'unknown action' })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'server error' })
  }
}
