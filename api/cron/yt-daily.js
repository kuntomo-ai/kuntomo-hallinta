// YouTube daily sync via Google OAuth (no API key).
// Fetches channel stats + recent video metrics + weekly watch time.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'
import { requireCron } from '../_lib/auth.js'
import { getGoogleToken } from '../_lib/googleOAuth.js'

const YT_DATA_BASE = 'https://www.googleapis.com/youtube/v3'

async function ytGet(path, params, token) {
  const url = new URL(`${YT_DATA_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${token}` } })
  if (!res.ok) throw new Error(`YouTube Data API ${res.status}: ${await res.text()}`)
  return res.json()
}

async function syncChannel(ch, token) {
  const today = new Date().toISOString().slice(0, 10)

  // 1. Channel statistics
  const chData = await ytGet('/channels', { part: 'statistics', id: ch.channel_id }, token)
  const stats = chData.items?.[0]?.statistics
  if (!stats) return { error: `No channel data for ${ch.channel_id}` }

  const { error: snapErr } = await supabaseAdmin.from('yt_channel_snapshots').upsert({
    channel_id: ch.id,
    snapshot_date: today,
    subscribers: parseInt(stats.subscriberCount) || null,
    total_views: parseInt(stats.viewCount) || null,
    video_count: parseInt(stats.videoCount) || null,
  }, { onConflict: 'channel_id,snapshot_date' })
  if (snapErr) return { error: `snapshot write failed: ${snapErr.message}` }

  // Update channel title/handle if missing
  if (!ch.title || !ch.handle) {
    const chInfo = await ytGet('/channels', { part: 'snippet', id: ch.channel_id }, token)
    const snippet = chInfo.items?.[0]?.snippet
    if (snippet) {
      await supabaseAdmin.from('yt_channels').update({
        title: snippet.title || ch.title,
        handle: snippet.customUrl || ch.handle,
      }).eq('id', ch.id)
    }
  }

  // 3. Recent videos (latest 15)
  const searchData = await ytGet('/search', {
    part: 'snippet',
    channelId: ch.channel_id,
    order: 'date',
    maxResults: 15,
    type: 'video',
  }, token)
  const items = searchData.items || []
  if (!items.length) return { ok: true, videos: 0 }

  const videoIds = items.map(v => v.id.videoId).filter(Boolean).join(',')
  if (!videoIds) return { ok: true, videos: 0 }

  // 4. Video statistics
  const vidData = await ytGet('/videos', { part: 'statistics,snippet', id: videoIds }, token)

  let saved = 0
  const writeErrors = []
  for (const item of vidData.items || []) {
    const s = item.statistics || {}
    const { error: vidErr } = await supabaseAdmin.from('yt_videos').upsert({
      id: item.id,
      channel_id: ch.id,
      title: item.snippet?.title,
      published_at: item.snippet?.publishedAt || null,
      thumbnail_url: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null,
    }, { onConflict: 'id' })
    if (vidErr) { writeErrors.push(`video ${item.id}: ${vidErr.message}`); continue }

    const { error: metErr } = await supabaseAdmin.from('yt_video_metrics').upsert({
      video_id: item.id,
      snapshot_date: today,
      views: parseInt(s.viewCount) || null,
      likes: parseInt(s.likeCount) || null,
      comments: parseInt(s.commentCount) || null,
    }, { onConflict: 'video_id,snapshot_date' })
    if (metErr) { writeErrors.push(`metrics ${item.id}: ${metErr.message}`) } else { saved++ }
  }

  const result = { ok: true, videos: saved }
  if (writeErrors.length) result.writeErrors = writeErrors
  return result
}

export async function runYtDaily() {
  let token
  try { token = await getGoogleToken() } catch (e) { return { skipped: e.message } }

  const { data: channels, error } = await supabaseAdmin
    .from('yt_channels')
    .select('*')
    .eq('is_active', true)
  if (error) return { error: error.message }
  if (!channels?.length) return { skipped: 'no active yt_channels' }

  const results = []
  for (const ch of channels) {
    try {
      results.push({ channel: ch.channel_id, ...(await syncChannel(ch, token)) })
    } catch (e) {
      results.push({ channel: ch.channel_id, error: e.message })
    }
  }
  return { results }
}

export default async function handler(req, res) {
  if (!requireCron(req, res)) return
  const result = await runYtDaily()
  return res.status(200).json({ ...result, ranAt: new Date().toISOString() })
}
