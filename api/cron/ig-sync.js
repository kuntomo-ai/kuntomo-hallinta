import { supabaseAdmin } from '../../lib/supabaseAdmin.js'
import {
  getProfile,
  getAccountInsights,
  getRecentMedia,
  getMediaInsights,
  flattenInsights,
  isTokenError,
} from '../../lib/instagram.js'
import { requireCron } from '../_lib/auth.js'

const TODAY = () => new Date().toISOString().slice(0, 10)

// Only refetch metrics for media posted in the last N days. Older posts are
// considered settled and not re-snapshotted to keep the cron cheap.
const RECENT_MEDIA_DAYS = 30

export default async function handler(req, res) {
  if (!requireCron(req, res)) return

  const started = Date.now()
  const log = { accounts: [], errors: [] }

  const { data: accounts, error: accErr } = await supabaseAdmin
    .from('ig_accounts')
    .select('id, ig_user_id, username, label, is_active')
    .eq('is_active', true)

  if (accErr) {
    return res.status(500).json({ error: accErr.message })
  }

  for (const acc of accounts || []) {
    const accLog = { id: acc.id, username: acc.username, profile: false, insights: false, media: 0, mediaMetrics: 0 }
    try {
      const { data: tok, error: tokErr } = await supabaseAdmin
        .from('ig_tokens')
        .select('access_token')
        .eq('account_id', acc.id)
        .maybeSingle()
      if (tokErr || !tok?.access_token) {
        throw new Error(`No token for account ${acc.username}: ${tokErr?.message || 'missing'}`)
      }
      const token = tok.access_token

      const profile = await getProfile(token)
      accLog.profile = true

      let insightsRaw = null
      let insightsFlat = {}
      try {
        insightsRaw = await getAccountInsights(token)
        insightsFlat = flattenInsights(insightsRaw)
        accLog.insights = true
      } catch (e) {
        log.errors.push(`insights ${acc.username}: ${e.message}`)
      }

      await supabaseAdmin.from('ig_account_snapshots').upsert({
        account_id: acc.id,
        snapshot_date: TODAY(),
        followers_count: profile.followers_count ?? null,
        reach: Number(insightsFlat.reach ?? 0) || null,
        profile_views: Number(insightsFlat.profile_views ?? 0) || null,
        raw: { profile, insights: insightsRaw },
      }, { onConflict: 'account_id,snapshot_date' })

      const media = await getRecentMedia(token, 25)
      const mediaRows = (media.data || []).map(m => ({
        account_id: acc.id,
        ig_media_id: m.id,
        media_type: m.media_type,
        caption: m.caption ?? null,
        permalink: m.permalink ?? null,
        thumbnail_url: m.thumbnail_url ?? null,
        posted_at: m.timestamp ?? null,
      }))
      if (mediaRows.length) {
        const { error } = await supabaseAdmin
          .from('ig_media')
          .upsert(mediaRows, { onConflict: 'ig_media_id' })
        if (error) log.errors.push(`media upsert ${acc.username}: ${error.message}`)
        accLog.media = mediaRows.length
      }

      // Pull each recent media's metrics. Need internal media UUIDs to FK.
      const recentCutoff = Date.now() - RECENT_MEDIA_DAYS * 86400e3
      const recentIgIds = (media.data || [])
        .filter(m => !m.timestamp || new Date(m.timestamp).getTime() >= recentCutoff)
        .map(m => m.id)
      if (recentIgIds.length) {
        const { data: localMedia } = await supabaseAdmin
          .from('ig_media')
          .select('id, ig_media_id')
          .in('ig_media_id', recentIgIds)
        const byIg = new Map((localMedia || []).map(r => [r.ig_media_id, r.id]))

        const metricsRows = []
        for (const igId of recentIgIds) {
          const localId = byIg.get(igId)
          if (!localId) continue
          try {
            const insights = await getMediaInsights(token, igId)
            const flat = flattenInsights(insights)
            metricsRows.push({
              media_id: localId,
              snapshot_date: TODAY(),
              likes: Number(flat.likes ?? 0),
              comments: Number(flat.comments ?? 0),
              saved: Number(flat.saved ?? 0),
              shares: Number(flat.shares ?? 0),
              reach: Number(flat.reach ?? 0),
              views: Number(flat.views ?? 0),
              total_interactions: Number(flat.total_interactions ?? 0),
              raw: insights,
            })
          } catch (e) {
            log.errors.push(`media insights ${igId} (${acc.username}): ${e.message}`)
            if (isTokenError(e)) break
          }
        }
        if (metricsRows.length) {
          const { error } = await supabaseAdmin
            .from('ig_media_metrics')
            .upsert(metricsRows, { onConflict: 'media_id,snapshot_date' })
          if (error) log.errors.push(`metrics upsert ${acc.username}: ${error.message}`)
          accLog.mediaMetrics = metricsRows.length
        }
      }
    } catch (e) {
      const tag = isTokenError(e) ? 'TOKEN_ERROR' : 'ERROR'
      log.errors.push(`${tag} ${acc.username}: ${e.message}`)
    }
    log.accounts.push(accLog)
  }

  log.elapsedMs = Date.now() - started
  res.status(200).json(log)
}
