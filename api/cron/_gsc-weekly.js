// Google Search Console weekly sync via shared Google OAuth token.
// Fetches previous week's summary + top 25 queries per active property.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'
import { requireCron } from '../_lib/auth.js'
import { getGoogleToken } from '../_lib/googleOAuth.js'

async function gscQuery(token, siteUrl, payload) {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`GSC API ${res.status}: ${await res.text()}`)
  return res.json()
}

function prevMondayISO() {
  const today = new Date()
  const dow = today.getUTCDay()
  const d = new Date(today)
  d.setUTCDate(today.getUTCDate() - (dow === 0 ? 6 : dow - 1) - 7)
  return d.toISOString().slice(0, 10)
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

async function syncProperty(property, token) {
  const weekStart = prevMondayISO()
  const weekEnd = addDays(weekStart, 6)

  // Overall weekly summary (no dimension = aggregate)
  const summaryData = await gscQuery(token, property.site_url, {
    startDate: weekStart,
    endDate: weekEnd,
    rowLimit: 1,
  })
  const row = summaryData.rows?.[0]
  const { error: sumErr } = await supabaseAdmin.from('gsc_weekly_summary').upsert({
    property_id: property.id,
    week_start: weekStart,
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? null,
    position: row?.position ?? null,
  }, { onConflict: 'property_id,week_start' })
  if (sumErr) return { error: `summary write failed: ${sumErr.message}` }

  // Top queries — fetch first, then replace atomically only if fetch succeeded
  const queryData = await gscQuery(token, property.site_url, {
    startDate: weekStart,
    endDate: weekEnd,
    dimensions: ['query'],
    rowLimit: 25,
  })
  const rows = (queryData.rows || []).map(r => ({
    property_id: property.id,
    week_start: weekStart,
    query: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }))

  if (rows.length) {
    const { error: delErr } = await supabaseAdmin.from('gsc_top_queries').delete()
      .eq('property_id', property.id)
      .eq('week_start', weekStart)
    if (delErr) return { error: `query delete failed: ${delErr.message}` }
    const { error: insErr } = await supabaseAdmin.from('gsc_top_queries').insert(rows)
    if (insErr) return { error: `query insert failed: ${insErr.message}` }
  }

  return { ok: true, queries: rows.length }
}

export async function runGscWeekly() {
  let token
  try { token = await getGoogleToken() } catch (e) { return { skipped: e.message } }

  const { data: properties, error } = await supabaseAdmin
    .from('gsc_properties').select('*').eq('is_active', true)
  if (error) return { error: error.message }
  if (!properties?.length) return { skipped: 'no active gsc_properties' }

  const results = []
  for (const prop of properties) {
    try {
      results.push({ property: prop.site_url, ...(await syncProperty(prop, token)) })
    } catch (e) {
      results.push({ property: prop.site_url, error: e.message })
    }
  }
  return { results }
}

export default async function handler(req, res) {
  if (!requireCron(req, res)) return
  const result = await runGscWeekly()
  return res.status(200).json({ ...result, ranAt: new Date().toISOString() })
}
