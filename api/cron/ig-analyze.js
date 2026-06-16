import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'
import { requireCron } from '../_lib/auth.js'

const MODEL = 'claude-sonnet-4-6'
const LOOKBACK_DAYS = 30

export default async function handler(req, res) {
  if (!requireCron(req, res)) return
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const periodEnd = new Date().toISOString().slice(0, 10)
  const periodStart = new Date(Date.now() - LOOKBACK_DAYS * 86400e3).toISOString().slice(0, 10)

  const { data: accounts } = await supabaseAdmin
    .from('ig_accounts')
    .select('id, username, label')
    .eq('is_active', true)

  const out = { analyses: [], errors: [] }

  for (const acc of accounts || []) {
    try {
      const [{ data: snaps }, { data: media }] = await Promise.all([
        supabaseAdmin
          .from('ig_account_snapshots')
          .select('snapshot_date, followers_count, reach, profile_views')
          .eq('account_id', acc.id)
          .gte('snapshot_date', periodStart)
          .lte('snapshot_date', periodEnd)
          .order('snapshot_date', { ascending: true }),
        supabaseAdmin
          .from('ig_media')
          .select('id, ig_media_id, media_type, caption, permalink, posted_at')
          .eq('account_id', acc.id)
          .gte('posted_at', periodStart)
          .order('posted_at', { ascending: false }),
      ])

      const mediaIds = (media || []).map(m => m.id)
      const { data: metrics } = mediaIds.length
        ? await supabaseAdmin
            .from('ig_media_metrics')
            .select('media_id, snapshot_date, likes, comments, saved, shares, reach, views, total_interactions')
            .in('media_id', mediaIds)
            .order('snapshot_date', { ascending: false })
        : { data: [] }

      // Latest metric row per media
      const latestByMedia = new Map()
      for (const m of metrics || []) {
        if (!latestByMedia.has(m.media_id)) latestByMedia.set(m.media_id, m)
      }

      const mediaDigest = (media || []).map(m => {
        const mx = latestByMedia.get(m.id) || {}
        return {
          posted_at: m.posted_at,
          media_type: m.media_type,
          caption: (m.caption || '').slice(0, 280),
          permalink: m.permalink,
          likes: mx.likes ?? null,
          comments: mx.comments ?? null,
          saved: mx.saved ?? null,
          shares: mx.shares ?? null,
          reach: mx.reach ?? null,
          views: mx.views ?? null,
          total_interactions: mx.total_interactions ?? null,
        }
      })

      const prompt = `Sinä olet sosiaalisen median analyytikko. Analysoi Instagram-tilin "${acc.username}" (${acc.label || ''}) suorituskykyä ajalta ${periodStart}–${periodEnd}.

PÄIVITTÄISET SNAPSHOTIT (seuraajat, reach, profiilikatselut):
${JSON.stringify(snaps || [], null, 2)}

JULKAISUT (kustakin uusin mittausarvo):
${JSON.stringify(mediaDigest, null, 2)}

Kirjoita tiivis, käyttökelpoinen yhteenveto **suomeksi markdown-muotoisena**. Rakenne:
- ## Yhteenveto (2–3 lausetta isoimmista huomioista)
- ## Trendit (seuraajakehitys, reach, profiilikatselut numeroin ja prosenttimuutoksin)
- ## Parhaat julkaisut (top 3 reach + interactions, kerro miksi toimivat)
- ## Heikoiten suoriutuneet (1–3 esimerkkiä, mahdollinen syy)
- ## Toimenpide-ehdotukset (3–5 konkreettista, mitattavaa toimenpidettä seuraaville 2 viikolle)

Älä keksi dataa. Jos joku metriikka puuttuu, mainitse se.`

      const msg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      })
      const summary_md = msg.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n')

      const { error: insErr } = await supabaseAdmin.from('ig_analyses').insert({
        account_id: acc.id,
        period_start: periodStart,
        period_end: periodEnd,
        summary_md,
        model: MODEL,
      })
      if (insErr) {
        out.errors.push(`db insert ${acc.username}: ${insErr.message}`)
      } else {
        out.analyses.push({ account_id: acc.id, username: acc.username, length: summary_md.length })
      }
    } catch (e) {
      out.errors.push(`analyze ${acc.username}: ${e.message}`)
    }
  }

  res.status(200).json(out)
}
