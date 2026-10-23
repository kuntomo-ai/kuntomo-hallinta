// LinkedIn Company Page weekly sync.
// Vaatii: LINKEDIN_ACCESS_TOKEN (Community Management API, r_organization_social).
// Hakee sivun seuraajat, viikkostatistiikat ja viimeisimmät julkaisut.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'
import { requireCron } from '../_lib/auth.js'

async function liGet(path, token) {
  const res = await fetch(`https://api.linkedin.com/v2${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202304',
    },
  })
  if (!res.ok) throw new Error(`LinkedIn API ${res.status}: ${await res.text()}`)
  return res.json()
}

function prevMondayMs() {
  const today = new Date()
  const dow = today.getUTCDay()
  const d = new Date(today)
  d.setUTCDate(today.getUTCDate() - (dow === 0 ? 6 : dow - 1) - 7)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime()
}

async function syncPage(page, token) {
  const today = new Date().toISOString().slice(0, 10)
  const orgUrn = encodeURIComponent(page.organization_id)

  // Follower statistics
  const followerData = await liGet(
    `/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${orgUrn}`,
    token
  )
  const followers = followerData.elements?.[0]?.totalFollowerCount ?? null

  // Page statistics — sum last week's data
  const endMs = Date.now()
  const startMs = prevMondayMs()
  const statsData = await liGet(
    `/organizationPageStatistics?q=organization&organization=${orgUrn}` +
    `&timeIntervals.timeGranularityType=DAY` +
    `&timeIntervals.timeRange.start=${startMs}` +
    `&timeIntervals.timeRange.end=${endMs}`,
    token
  )

  let impressions = 0
  for (const el of statsData.elements || []) {
    const ts = el.timeRange?.start
    if (ts && ts >= startMs) {
      impressions += el.totalPageStatistics?.views?.allPageViews?.pageViews || 0
    }
  }

  await supabaseAdmin.from('li_page_snapshots').upsert({
    page_id: page.id,
    snapshot_date: today,
    followers,
    impressions,
  }, { onConflict: 'page_id,snapshot_date' })

  // Recent posts (ugcPosts)
  let postCount = 0
  try {
    const postsData = await liGet(
      `/ugcPosts?q=authors&authors=List(${orgUrn})&count=10&sortBy=LAST_MODIFIED`,
      token
    )
    for (const post of postsData.elements || []) {
      const postId = post.id
      if (!postId) continue
      const publishedAt = post.created?.time ? new Date(post.created.time).toISOString() : null
      const textContent = post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || null
      const mediaCategory = post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory || null

      await supabaseAdmin.from('li_posts').upsert({
        id: postId,
        page_id: page.id,
        published_at: publishedAt,
        text_content: textContent?.slice(0, 1000) || null,
        media_type: mediaCategory,
      }, { onConflict: 'id' })
      postCount++
    }
  } catch {
    // Post fetching is non-critical — continue without it
  }

  return { ok: true, followers, impressions, posts: postCount }
}

export async function runLiWeekly() {
  if (!process.env.LINKEDIN_ACCESS_TOKEN) {
    return { skipped: 'LINKEDIN_ACCESS_TOKEN not configured' }
  }
  const { data: pages, error } = await supabaseAdmin
    .from('li_pages').select('*').eq('is_active', true)
  if (error) return { error: error.message }
  if (!pages?.length) return { skipped: 'no active li_pages' }

  const token = process.env.LINKEDIN_ACCESS_TOKEN
  const results = []
  for (const page of pages) {
    try {
      results.push({ page: page.name || page.organization_id, ...(await syncPage(page, token)) })
    } catch (e) {
      results.push({ page: page.name || page.organization_id, error: e.message })
    }
  }
  return { results }
}

export default async function handler(req, res) {
  if (!requireCron(req, res)) return
  const result = await runLiWeekly()
  return res.status(200).json({ ...result, ranAt: new Date().toISOString() })
}
