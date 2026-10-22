// Automaattinen viikkoraportti joka maanantai klo 10 EET (08 UTC).
// Auth: CRON_SECRET (sama kuin muut cronit).
// ?dryRun=1  → palauttaa HTML:n selaimeen, ei lähetä sähköpostia.
// ?week=YYYY-MM-DD → korvaa automaattisen viikon maanantailla.
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'
import { requireCron } from '../_lib/auth.js'

const MODEL = 'claude-sonnet-4-6'

const TOIMIPISTEET = [
  { nimi: 'Etu-Lyötty',    paikkakunta: 'Oulu',    osoite: 'Etu-Lyötyntie, Oulu' },
  { nimi: 'Kempele',        paikkakunta: 'Kempele', osoite: 'Kempele' },
  { nimi: 'Linnakangas',    paikkakunta: 'Oulu',    osoite: 'Linnakangas, Oulu' },
  { nimi: 'Toppilansaari',  paikkakunta: 'Oulu',    osoite: 'Toppilansaari, Oulu' },
]
const PALVELUT = ['hieronta', 'fysioterapia', 'OMT', 'PT', 'valmennus', 'jäsenyys']
const GMBA_TEEMAT = ['hieronta ja fysioterapia', 'PT/valmennus', 'jäsenyys', 'ajankohtainen/sesonki']
const BASE_URL = 'https://hallinta.kuntomo.com'

// ── Date utils ───────────────────────────────────────────────────────────────

function isoWeekNumber(d) {
  const date = new Date(d)
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
}

function getWeekRange(weekParam) {
  let monISO
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    monISO = weekParam
  } else {
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const dow = today.getUTCDay()
    const thisMon = new Date(today)
    thisMon.setUTCDate(today.getUTCDate() - (dow === 0 ? 6 : dow - 1))
    const prevMon = new Date(thisMon)
    prevMon.setUTCDate(thisMon.getUTCDate() - 7)
    monISO = prevMon.toISOString().slice(0, 10)
  }
  const mon = new Date(monISO + 'T00:00:00Z')
  const prevMon = new Date(mon)
  prevMon.setUTCDate(mon.getUTCDate() - 7)
  const sun = new Date(mon)
  sun.setUTCDate(mon.getUTCDate() + 6)
  const prevSun = new Date(prevMon)
  prevSun.setUTCDate(prevMon.getUTCDate() + 6)
  const weekNum = isoWeekNumber(mon)
  return {
    start: monISO,
    end: sun.toISOString().slice(0, 10),
    prevStart: prevMon.toISOString().slice(0, 10),
    prevEnd: prevSun.toISOString().slice(0, 10),
    weekNum,
    theme: GMBA_TEEMAT[weekNum % 4],
  }
}

function fiDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

function daysSince(iso) {
  return Math.floor((Date.now() - new Date(iso)) / 86400000)
}

function eur(v) { return `${(v || 0).toFixed(2).replace('.', ',')} €` }
function delta(curr, prev) {
  if (!prev) return ''
  const d = curr - prev
  const pct = prev > 0 ? Math.round((d / prev) * 100) : 0
  const sign = d >= 0 ? '+' : ''
  return `<span style="color:${d >= 0 ? '#16a34a' : '#dc2626'};font-size:.8em"> ${sign}${pct}%</span>`
}

// ── Data fetchers ────────────────────────────────────────────────────────────

// Returns { data, fetchError } — callers check fetchError to surface warnings in report.
async function safeFetch(query) {
  const result = await query
  return { data: result.data || [], fetchError: result.error ? result.error.message : null }
}

function nextDay(dateISO) {
  const d = new Date(dateISO + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

async function fetchLaskutettavat() {
  return safeFetch(
    supabaseAdmin
      .from('terapiamyynti')
      .select('id, visit_date, customer_name, service, price, seller_id, notes, payment_method, employee_name')
      .ilike('payment_method', '%Laskutus%')
      .or('laskutettu.is.null,laskutettu.eq.false')
      .order('visit_date', { ascending: true })
      .limit(500)
  )
}

async function fetchLaskutettuViikolla(week) {
  return safeFetch(
    supabaseAdmin
      .from('terapiamyynti')
      .select('price')
      .ilike('payment_method', '%Laskutus%')
      .eq('laskutettu', true)
      .gte('visit_date', week.start)
      .lt('visit_date', nextDay(week.end))
      .limit(500)
  )
}

async function fetchLahjakorttiSelvitettavat() {
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  return safeFetch(
    supabaseAdmin
      .from('terapiamyynti')
      .select('visit_date, customer_name, notes, price')
      .ilike('payment_method', '%Lahjakortti%')
      .ilike('notes', '%ei löydy järjestelmästä%')
      .gte('visit_date', cutoff)
      .order('visit_date', { ascending: false })
      .limit(100)
  )
}

async function fetchTasks(week) {
  const { data: all, fetchError } = await safeFetch(
    supabaseAdmin
      .from('tasks')
      .select('id, title, description, status, completed, due_date, assigned_to, created_by, priority, created_at')
      .order('created_at', { ascending: false })
      .limit(500)
  )
  if (fetchError) return { newTasks: [], lateTasks: [], completedThisWeek: [], fetchError }
  const now = new Date()
  const weekEndTs = new Date(nextDay(week.end) + 'T00:00:00Z')
  const weekStartTs = new Date(week.start + 'T00:00:00Z')
  const isDone = t => t.completed || t.status === 'valmis' || t.status === 'done'
  const isLate = t => t.due_date && new Date(t.due_date) < now
  const newTasks = all.filter(t => {
    const ca = new Date(t.created_at)
    return ca >= weekStartTs && ca < weekEndTs
  })
  const lateTasks = all.filter(t => !isDone(t) && isLate(t))
  // No completion timestamp in schema — show tasks created this week that are currently marked done
  const completedThisWeek = all.filter(t => isDone(t) && new Date(t.created_at) >= weekStartTs && new Date(t.created_at) < weekEndTs)
  return { newTasks, lateTasks, completedThisWeek }
}

async function fetchTunnusluvut(week) {
  const nd = nextDay
  const queries = [
    supabaseAdmin.from('terapiamyynti').select('price, seller_id, employee_name').gte('visit_date', week.start).lt('visit_date', nd(week.end)).limit(1000),
    supabaseAdmin.from('terapiamyynti').select('price').gte('visit_date', week.prevStart).lt('visit_date', nd(week.prevEnd)).limit(1000),
    supabaseAdmin.from('valmennusmyynti').select('price').gte('visit_date', week.start).lt('visit_date', nd(week.end)).limit(1000),
    supabaseAdmin.from('valmennusmyynti').select('price').gte('visit_date', week.prevStart).lt('visit_date', nd(week.prevEnd)).limit(1000),
    supabaseAdmin.from('jasenmyynti').select('price').gte('visit_date', week.start).lt('visit_date', nd(week.end)).limit(1000),
    supabaseAdmin.from('jasenmyynti').select('price').gte('visit_date', week.prevStart).lt('visit_date', nd(week.prevEnd)).limit(1000),
    supabaseAdmin.from('mobilepay_transactions').select('amount').eq('type', 'Toteutunut').gte('booking_date', week.start).lt('booking_date', nd(week.end)).limit(1000),
    supabaseAdmin.from('mobilepay_transactions').select('amount').eq('type', 'Toteutunut').gte('booking_date', week.prevStart).lt('booking_date', nd(week.prevEnd)).limit(1000),
    supabaseAdmin.from('laiteluettelo_items').select('id').eq('service_requested', true),
  ]
  const results = await Promise.all(queries)
  const errors = results.filter(r => r.error).map(r => r.error.message)
  const sum = r => (r?.data || []).reduce((s, row) => s + (parseFloat(row.price ?? row.amount) || 0), 0)
  const [t, tp, v, vp, j, jp, mp, mpp, dev] = results
  return {
    terapia:       { eur: sum(t),   kpl: t?.data?.length ?? 0 },
    terapiaPrev:   { eur: sum(tp),  kpl: tp?.data?.length ?? 0 },
    valmennus:     { eur: sum(v),   kpl: v?.data?.length ?? 0 },
    valmennusPrev: { eur: sum(vp),  kpl: vp?.data?.length ?? 0 },
    jasen:         { eur: sum(j),   kpl: j?.data?.length ?? 0 },
    jasenPrev:     { eur: sum(jp),  kpl: jp?.data?.length ?? 0 },
    mobilepay:     { eur: sum(mp),  kpl: mp?.data?.length ?? 0 },
    mobilepayPrev: { eur: sum(mpp), kpl: mpp?.data?.length ?? 0 },
    avoinVikailmoitus: dev?.data?.length ?? 0,
    fetchErrors: errors,
  }
}

async function fetchInstagram(week) {
  const igErrors = []
  const [accs, media, prevMedia] = await Promise.all([
    supabaseAdmin.from('ig_accounts').select('id, username, label').eq('is_active', true),
    supabaseAdmin.from('ig_media').select('id, account_id, posted_at, caption, permalink').gte('posted_at', week.start + 'T00:00:00Z').lt('posted_at', nextDay(week.end) + 'T00:00:00Z').limit(200),
    supabaseAdmin.from('ig_media').select('account_id').gte('posted_at', week.prevStart + 'T00:00:00Z').lt('posted_at', nextDay(week.prevEnd) + 'T00:00:00Z').limit(200),
  ])
  if (accs?.error)      igErrors.push(`ig_accounts: ${accs.error.message}`)
  if (media?.error)     igErrors.push(`ig_media: ${media.error.message}`)
  if (prevMedia?.error) igErrors.push(`ig_media (prev): ${prevMedia.error.message}`)
  const accounts = accs?.data || []
  const weekPosts = media?.data || []
  const prevPosts = prevMedia?.data || []
  // Latest metrics for this week's posts
  let bestPost = null
  if (weekPosts.length) {
    const mediaIds = weekPosts.map(m => m.id)
    const metricsRes = await supabaseAdmin
      .from('ig_media_metrics')
      .select('media_id, reach, likes, snapshot_date')
      .in('media_id', mediaIds)
      .order('snapshot_date', { ascending: false })
    if (metricsRes.error) igErrors.push(`ig_media_metrics: ${metricsRes.error.message}`)
    const latest = {}
    for (const m of metricsRes.data || []) {
      if (!latest[m.media_id]) latest[m.media_id] = m
    }
    let best = null, bestReach = -1
    for (const p of weekPosts) {
      const mx = latest[p.id]
      if (mx && (mx.reach || 0) > bestReach) {
        bestReach = mx.reach || 0
        best = { ...p, reach: mx.reach, likes: mx.likes }
      }
    }
    bestPost = best
  }
  // Last post date per account (to flag 7-day silence)
  const lastPostsRes = await supabaseAdmin
    .from('ig_media')
    .select('account_id, posted_at')
    .in('account_id', accounts.map(a => a.id))
    .order('posted_at', { ascending: false })
  if (lastPostsRes.error) igErrors.push(`ig_media (last): ${lastPostsRes.error.message}`)
  const lastPosts = lastPostsRes
  const lastByAcc = {}
  for (const p of lastPosts.data || []) {
    if (!lastByAcc[p.account_id]) lastByAcc[p.account_id] = p.posted_at
  }
  const postCountByAcc = {}
  const prevCountByAcc = {}
  for (const p of weekPosts)  postCountByAcc[p.account_id] = (postCountByAcc[p.account_id] || 0) + 1
  for (const p of prevPosts) prevCountByAcc[p.account_id] = (prevCountByAcc[p.account_id] || 0) + 1
  return { accounts, postCountByAcc, prevCountByAcc, lastByAcc, bestPost, fetchError: igErrors.length ? igErrors.join('; ') : null }
}

async function fetchSellerNames(sellerIds) {
  if (!sellerIds.length) return {}
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', sellerIds)
  const map = {}
  for (const p of data || []) map[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.id
  return map
}

// ── AI content ───────────────────────────────────────────────────────────────

async function generateAiContent(week, data) {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const { tunnusluvut: t, tasks, laskutettavat, ig } = data
  const bestPostInfo = ig.bestPost
    ? `Paras posti: "${(ig.bestPost.caption || '').slice(0, 80)}..." (reach ${ig.bestPost.reach}, likes ${ig.bestPost.likes || 0}), linkki: ${ig.bestPost.permalink || '—'}`
    : 'Ei julkaisuja viikolla.'
  const prompt = `Olet Kuntomo-hyvinvointikeskuksen markkinointi- ja liiketoiminta-avustaja.
Tänään on vko ${week.weekNum} maanantai. Viime viikko oli vko ${week.weekNum - 1}.
Tällä viikolla julkaisujen teema on: "${week.theme}".

TOIMIPISTEET: ${TOIMIPISTEET.map(t => `${t.nimi} (${t.paikkakunta})`).join(', ')}.
PALVELUT: ${PALVELUT.join(', ')}.
SLOGAN: "Kunnolla Tehty". Varaukset ja ostot vain verkossa. Kohderyhmä Oulu/Kempele.

VIIME VIIKON TILASTOT (aggregaatit, ei nimiä):
- Terapiamyynti: ${eur(t.terapia.eur)}, ${t.terapia.kpl} kpl
- Valmennusmyynti: ${eur(t.valmennus.eur)}, ${t.valmennus.kpl} kpl
- Jäsenmyynti: ${eur(t.jasen.eur)}, ${t.jasen.kpl} kpl
- MobilePay: ${eur(t.mobilepay.eur)}, ${t.mobilepay.kpl} kpl
- Laskuttamatta: ${laskutettavat.length} kpl (vanhin ${laskutettavat.length ? `${daysSince(laskutettavat[0].visit_date)} pv sitten` : '—'})
- Myöhässä tehtäviä: ${tasks.lateTasks.length} kpl
INSTAGRAM: ${bestPostInfo}

Luo seuraavat osiot täsmälleen tässä järjestyksessä ja muodossa:

## GOOGLE MY BUSINESS -PÄIVITYKSET ENSI VIIKOLLE
${TOIMIPISTEET.map((tp, i) => `### ${i + 1}. ${tp.nimi}
[Noin 80–150 sanaa. Mainitse toimipisteen nimi ja paikkakunta luonnollisesti. Sisällytä toimintakehote (varaa / osta verkossa). Ehdota kuvan aihe: "Kuva-aihe: ...". Teema: ${week.theme}.]`).join('\n')}

## SOME-SISÄLTÖEHDOTUKSET ENSI VIIKOLLE
(Ehdotukset Kuksa Medialle (IG/FB) ja Sannalle (TikTok) välitettäväksi)

### Instagram-postaukset (3 kpl, vähintään 1 pohjautuu viime viikon parhaaseen postiin)
1. [Kuvateksti + kuvan/videon idea + hashtagit]
2. [Kuvateksti + kuvan/videon idea + hashtagit]
3. [Kuvateksti + kuvan/videon idea + hashtagit]

### LinkedIn (Jussin ääni, yrittäjyys/Kuntomon kasvu/Helsinki)
[1 postaus]

### TikTok-ideat (2 kpl, brändinrakennus Helsinki-muutto)
1. [Koukku + idea]
2. [Koukku + idea]

## VIIKON YHTEENVETO
[Tasan 3 lausetta. Suomeksi. Suora sävy. Syötteenä vain aggregaatit. Mikä vaatii huomiota tällä viikolla?]`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })
    return msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
  } catch {
    return null
  }
}

// ── HTML builder ─────────────────────────────────────────────────────────────

function escape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sectionHeader(title, link, linkLabel) {
  return `<tr><td style="padding:20px 0 8px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#7c3aed">${escape(title)}</span></td>
      ${link ? `<td align="right"><a href="${link}" style="font-size:12px;color:#7c3aed;text-decoration:none">${escape(linkLabel || 'Avaa →')}</a></td>` : ''}
    </tr></table>
  </td></tr>`
}

function buildLaskutettavatSection(rows, laskutettuViikolla, sellers) {
  if (!rows.length) {
    return `<tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;color:#166534;font-size:14px">✓ Ei laskutettavaa</td></tr>`
  }
  const totalEur = rows.reduce((s, r) => s + (parseFloat(r.price) || 0), 0)
  const oldest = daysSince(rows[0].visit_date)
  const summary = `<tr><td style="font-size:13px;color:#374151;padding-bottom:8px">
    <strong>${rows.length} kpl</strong> · Yhteensä <strong>${eur(totalEur)}</strong> · Vanhin <strong>${oldest} pv</strong>
    ${laskutettuViikolla.length ? `&nbsp;·&nbsp;<span style="color:#166534">Viikolla laskutettu: ${laskutettuViikolla.length} kpl (${eur(laskutettuViikolla.reduce((s, r) => s + (parseFloat(r.price) || 0), 0))})</span>` : ''}
  </td></tr>`
  const tableRows = rows.map(r => {
    const age = daysSince(r.visit_date)
    const overdue = age > 14
    const bg = overdue ? '#fef2f2' : '#ffffff'
    const nameDisplay = r.employee_name || sellers[r.seller_id] || '—'
    return `<tr style="background:${bg}">
      <td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #f3f4f6">${escape(fiDate(r.visit_date))}</td>
      <td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #f3f4f6"><strong>${escape(r.customer_name || '—')}</strong></td>
      <td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #f3f4f6">${escape(r.service || '—')}</td>
      <td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #f3f4f6;text-align:right">${eur(r.price)}</td>
      <td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #f3f4f6">${escape(nameDisplay)}</td>
      ${overdue ? '<td style="padding:6px 8px;font-size:11px;color:#dc2626;border-bottom:1px solid #f3f4f6">⚠ Yli 14 pv</td>' : '<td style="border-bottom:1px solid #f3f4f6"></td>'}
    </tr>`
  }).join('')
  return summary + `<tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;border-collapse:separate;overflow:hidden">
      <tr style="background:#f9fafb">
        <th style="padding:6px 8px;font-size:11px;text-align:left;color:#6b7280;font-weight:600">Pvm</th>
        <th style="padding:6px 8px;font-size:11px;text-align:left;color:#6b7280;font-weight:600">Asiakas</th>
        <th style="padding:6px 8px;font-size:11px;text-align:left;color:#6b7280;font-weight:600">Palvelu</th>
        <th style="padding:6px 8px;font-size:11px;text-align:right;color:#6b7280;font-weight:600">Hinta</th>
        <th style="padding:6px 8px;font-size:11px;text-align:left;color:#6b7280;font-weight:600">Terapeutti</th>
        <th></th>
      </tr>${tableRows}
    </table>
  </td></tr>`
}

function buildLahjakorttiSection(rows) {
  if (!rows.length) return `<tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;color:#166534;font-size:14px">✓ Ei selvitettäviä lahjakortteja</td></tr>`
  const tableRows = rows.map(r => `<tr>
    <td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #f3f4f6">${escape(fiDate(r.visit_date))}</td>
    <td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #f3f4f6">${escape(r.customer_name || '—')}</td>
    <td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #f3f4f6;color:#6b7280">${escape((r.notes || '').slice(0, 80))}</td>
    <td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #f3f4f6;text-align:right">${eur(r.price)}</td>
  </tr>`).join('')
  return `<tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;border-collapse:separate;overflow:hidden">
      <tr style="background:#f9fafb">
        <th style="padding:6px 8px;font-size:11px;text-align:left;color:#6b7280;font-weight:600">Pvm</th>
        <th style="padding:6px 8px;font-size:11px;text-align:left;color:#6b7280;font-weight:600">Asiakas</th>
        <th style="padding:6px 8px;font-size:11px;text-align:left;color:#6b7280;font-weight:600">Muistiinpano</th>
        <th style="padding:6px 8px;font-size:11px;text-align:right;color:#6b7280;font-weight:600">Summa</th>
      </tr>${tableRows}
    </table>
  </td></tr>`
}

function buildTasksSection(tasks) {
  const { newTasks, lateTasks, completedThisWeek } = tasks
  let html = ''
  if (lateTasks.length) {
    html += `<tr><td style="font-size:12px;font-weight:700;color:#dc2626;padding:4px 0 4px">⚠ Myöhässä (${lateTasks.length} kpl)</td></tr>`
    html += `<tr><td><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fecaca;border-radius:6px;border-collapse:separate;overflow:hidden">`
    html += lateTasks.map(t => {
      const daysLate = t.due_date ? Math.floor((Date.now() - new Date(t.due_date)) / 86400000) : '?'
      return `<tr style="background:#fef2f2"><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #fee2e2"><strong>${escape(t.title)}</strong><br><span style="font-size:11px;color:#6b7280">${escape(t.assigned_to || '—')} · DL ${fiDate(t.due_date)} · <span style="color:#dc2626">${daysLate} pv myöhässä</span></span></td></tr>`
    }).join('')
    html += `</table></td></tr>`
  }
  if (newTasks.length) {
    html += `<tr><td style="font-size:12px;font-weight:700;color:#374151;padding:10px 0 4px">Uudet tehtävät viikolla (${newTasks.length} kpl)</td></tr>`
    html += `<tr><td><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;border-collapse:separate;overflow:hidden">`
    html += newTasks.map(t => `<tr>
      <td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #f3f4f6">
        <strong>${escape(t.title)}</strong>
        <span style="margin-left:6px;font-size:11px;padding:2px 6px;border-radius:9px;background:${t.priority === 'high' ? '#fef2f2' : '#f3f4f6'};color:${t.priority === 'high' ? '#dc2626' : '#374151'}">${escape(t.priority || 'medium')}</span><br>
        <span style="font-size:11px;color:#6b7280">${escape((t.description || '').slice(0, 100))}${t.due_date ? ' · DL ' + fiDate(t.due_date) : ''} · ${escape(t.assigned_to || '—')}</span>
      </td>
    </tr>`).join('')
    html += `</table></td></tr>`
  }
  if (completedThisWeek.length) {
    html += `<tr><td style="font-size:13px;color:#166534;padding:8px 0 0">✓ Viikolla luodut, tällä hetkellä valmiit: ${completedThisWeek.length} kpl — ${completedThisWeek.map(t => `<em>${escape(t.title)}</em>`).join(', ')}</td></tr>`
  }
  if (!lateTasks.length && !newTasks.length) {
    html += `<tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;color:#166534;font-size:14px">✓ Ei uusia tai myöhässä olevia tehtäviä</td></tr>`
  }
  return html
}

function buildTunnusluvutSection(t) {
  const rows = [
    ['Terapiamyynti', t.terapia.eur, t.terapia.kpl, t.terapiaPrev.eur, t.terapiaPrev.kpl],
    ['Valmennusmyynti', t.valmennus.eur, t.valmennus.kpl, t.valmennusPrev.eur, t.valmennusPrev.kpl],
    ['Jäsenmyynti', t.jasen.eur, t.jasen.kpl, t.jasenPrev.eur, t.jasenPrev.kpl],
    ['MobilePay', t.mobilepay.eur, t.mobilepay.kpl, t.mobilepayPrev.eur, t.mobilepayPrev.kpl],
  ]
  const tableRows = rows.map(([label, e, k, ep, kp]) => `<tr>
    <td style="padding:7px 8px;font-size:13px;border-bottom:1px solid #f3f4f6">${escape(label)}</td>
    <td style="padding:7px 8px;font-size:13px;border-bottom:1px solid #f3f4f6;text-align:right"><strong>${eur(e)}</strong>${delta(e, ep)}</td>
    <td style="padding:7px 8px;font-size:13px;border-bottom:1px solid #f3f4f6;text-align:right">${k} kpl${delta(k, kp)}</td>
  </tr>`).join('')
  return `<tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;border-collapse:separate;overflow:hidden">
      <tr style="background:#f9fafb">
        <th style="padding:6px 8px;font-size:11px;text-align:left;color:#6b7280;font-weight:600">Kategoria</th>
        <th style="padding:6px 8px;font-size:11px;text-align:right;color:#6b7280;font-weight:600">Myynti €</th>
        <th style="padding:6px 8px;font-size:11px;text-align:right;color:#6b7280;font-weight:600">Kpl</th>
      </tr>${tableRows}
    </table>
    ${t.avoinVikailmoitus > 0 ? `<p style="margin:8px 0 0;font-size:13px;color:#92400e">⚠ Avoimia vikailmoituksia: <strong>${t.avoinVikailmoitus} kpl</strong></p>` : ''}
  </td></tr>`
}

function buildInstagramSection(ig) {
  const { accounts, postCountByAcc, prevCountByAcc, lastByAcc, bestPost } = ig
  const rows = accounts.map(acc => {
    const count = postCountByAcc[acc.id] || 0
    const prevCount = prevCountByAcc[acc.id] || 0
    const lastDate = lastByAcc[acc.id]
    const silenced = lastDate && daysSince(lastDate) >= 7
    return `<tr style="${silenced ? 'background:#fef2f2' : ''}">
      <td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #f3f4f6">${escape(acc.label || acc.username)}</td>
      <td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #f3f4f6;text-align:center">${count} ${delta(count, prevCount)}</td>
      <td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #f3f4f6;${silenced ? 'color:#dc2626;font-weight:600' : 'color:#6b7280'}">${lastDate ? fiDate(lastDate.slice(0, 10)) : '—'}${silenced ? ' ⚠ yli 7 pv' : ''}</td>
    </tr>`
  }).join('')
  const safePermalink = /^https:\/\/www\.instagram\.com\//.test(bestPost?.permalink || '') ? bestPost.permalink : null
  const bestHtml = bestPost
    ? `<p style="margin:10px 0 0;font-size:13px"><strong>Paras posti:</strong> reach ${bestPost.reach ?? '—'}, likes ${bestPost.likes ?? '—'} — ${safePermalink ? `<a href="${escape(safePermalink)}" style="color:#7c3aed">Avaa Instagramissa</a>` : 'ei linkkiä'}<br><span style="color:#6b7280">${escape((bestPost.caption || '').slice(0, 120))}</span></p>`
    : '<p style="margin:10px 0 0;font-size:13px;color:#6b7280">Ei julkaisuja viikolla.</p>'
  return `<tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;border-collapse:separate;overflow:hidden">
      <tr style="background:#f9fafb">
        <th style="padding:6px 8px;font-size:11px;text-align:left;color:#6b7280;font-weight:600">Tili</th>
        <th style="padding:6px 8px;font-size:11px;text-align:center;color:#6b7280;font-weight:600">Julkaisut vk</th>
        <th style="padding:6px 8px;font-size:11px;text-align:left;color:#6b7280;font-weight:600">Viimeisin julkaisu</th>
      </tr>${rows}
    </table>
    ${bestHtml}
  </td></tr>`
}

function mdToHtml(md) {
  if (!md) return '<p style="color:#6b7280;font-size:13px">AI-sisältö ei saatavilla.</p>'
  return md
    .split('\n')
    .map(line => {
      if (line.startsWith('### ')) return `<h4 style="margin:12px 0 4px;font-size:13px;font-weight:700;color:#374151">${escape(line.slice(4))}</h4>`
      if (line.startsWith('## '))  return `<h3 style="margin:14px 0 4px;font-size:14px;font-weight:700;color:#7c3aed">${escape(line.slice(3))}</h3>`
      if (line.startsWith('# '))   return `<h2 style="margin:16px 0 4px;font-size:15px;font-weight:700;color:#1f2937">${escape(line.slice(2))}</h2>`
      if (!line.trim()) return '<br>'
      return `<p style="margin:4px 0;font-size:13px;line-height:1.5;color:#374151">${escape(line)}</p>`
    })
    .join('')
}

function buildEmail(week, sections, subject) {
  const { laskutettavatHtml, lahjakorttiHtml, tasksHtml, tunnusluvutHtml, igHtml, aiHtml, errorBanner = '' } = sections
  return `<!DOCTYPE html><html lang="fi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 16px">
<tr><td align="center">
<table width="100%" style="max-width:600px" cellpadding="0" cellspacing="0">

  <!-- Header -->
  <tr><td style="background:#7c3aed;border-radius:8px 8px 0 0;padding:20px 24px">
    <p style="margin:0;font-size:18px;font-weight:700;color:#fff">Kuntomo viikkoraportti</p>
    <p style="margin:4px 0 0;font-size:13px;color:#ddd6fe">Vko ${week.weekNum} · ${fiDate(week.start)}–${fiDate(week.end)}</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#fff;border-radius:0 0 8px 8px;padding:0 24px 24px">
  <table width="100%" cellpadding="0" cellspacing="0">

    ${errorBanner}

    ${sectionHeader('1. Laskutettavat terapiamyynnit', `${BASE_URL}/sales`, 'Avaa Myynti →')}
    ${laskutettavatHtml}

    ${sectionHeader('2. Selvitettävät lahjakortit', `${BASE_URL}/sales`, 'Avaa Myynti →')}
    ${lahjakorttiHtml}

    ${sectionHeader('3. Tehtävät', `${BASE_URL}/tasks`, 'Avaa Tehtävät →')}
    ${tasksHtml}

    ${sectionHeader('4. Viikon tunnusluvut', `${BASE_URL}/sales`, 'Avaa Myynti →')}
    ${tunnusluvutHtml}

    ${sectionHeader('5. Instagram viime viikolla', `${BASE_URL}/instagram`, 'Avaa Instagram →')}
    ${igHtml}

    ${sectionHeader('5b–c + 6. Markkinointi & AI-yhteenveto')}
    <tr><td style="font-size:13px;line-height:1.6;color:#374151">${aiHtml}</td></tr>

  </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 0;text-align:center">
    <p style="margin:0;font-size:11px;color:#9ca3af">Automaattinen viikkoraportti · Kuntomo ERP · <a href="${BASE_URL}" style="color:#7c3aed;text-decoration:none">hallinta.kuntomo.com</a></p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (!requireCron(req, res)) return

  const week = getWeekRange(req.query?.week)
  const isDryRun = req.query?.dryRun === '1'

  // Fetch all data in parallel
  const [laskRes, laskVkRes, lahjaRes, tasks, tunnusluvut, ig] = await Promise.all([
    fetchLaskutettavat(),
    fetchLaskutettuViikolla(week),
    fetchLahjakorttiSelvitettavat(),
    fetchTasks(week),
    fetchTunnusluvut(week),
    fetchInstagram(week),
  ])
  const laskutettavat = laskRes.data
  const laskutettuViikolla = laskVkRes.data
  const lahjakortit = lahjaRes.data

  // Collect any DB errors for display at top of report
  const dbErrors = [
    laskRes.fetchError       && `Laskutettavat: ${laskRes.fetchError}`,
    laskVkRes.fetchError     && `Laskutettu viikolla: ${laskVkRes.fetchError}`,
    lahjaRes.fetchError      && `Lahjakortit: ${lahjaRes.fetchError}`,
    tasks.fetchError         && `Tehtävät: ${tasks.fetchError}`,
    ig.fetchError            && `Instagram: ${ig.fetchError}`,
    ...(tunnusluvut.fetchErrors || []),
  ].filter(Boolean)

  // Seller name lookup
  const sellerIds = [...new Set(laskutettavat.map(r => r.seller_id).filter(Boolean))]
  const sellers = await fetchSellerNames(sellerIds)

  // AI content
  const aiMd = await generateAiContent(week, { tunnusluvut, tasks, laskutettavat, ig })

  // Build sections
  const errorBanner = dbErrors.length
    ? `<tr><td style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;margin-bottom:8px;font-size:12px;color:#dc2626"><strong>⚠ Tietojen haussa virheitä — osa raportin tiedoista voi puuttua:</strong><br>${dbErrors.map(e => escape(e)).join('<br>')}</td></tr>`
    : ''

  const sections = {
    laskutettavatHtml: buildLaskutettavatSection(laskutettavat, laskutettuViikolla, sellers),
    lahjakorttiHtml: buildLahjakorttiSection(lahjakortit),
    tasksHtml: buildTasksSection(tasks),
    tunnusluvutHtml: buildTunnusluvutSection(tunnusluvut),
    igHtml: buildInstagramSection(ig),
    aiHtml: mdToHtml(aiMd),
  }

  const subject = `Kuntomo vko ${week.weekNum} – laskutettavaa ${eur(laskutettavat.reduce((s, r) => s + (parseFloat(r.price) || 0), 0))} (${laskutettavat.length} kpl), ${tasks.lateTasks.length} tehtävää myöhässä`
  const html = buildEmail(week, { ...sections, errorBanner }, subject)

  if (isDryRun) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(html)
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.REPORT_FROM || 'Kuntomo Hallinta <raportit@kuntomo.com>'
  const to = (process.env.REPORT_RECIPIENTS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!apiKey || !to.length) {
    return res.status(500).json({ error: 'RESEND_API_KEY or REPORT_RECIPIENTS not configured' })
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({ from, to, subject, html })
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true, week: week.start, subject, recipients: to })
}
