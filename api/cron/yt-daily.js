// YouTube Data API v3 daily sync — ei vaadi OAuth, vain API-avain.
// Hakee kanavat yt_channels-taulusta, tallentaa snapshots + videot + metriikat.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'
import { requireCron } from '../_lib/auth.js'

const YT_BASE = 'https://www.googleapis.com/youtube/v3'

async function ytGet(path, params) {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_API_KEY not configured')
  const url = new URL(`${YT_BASE}${path}`)
  url.searchParams.set('key', apiKey)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${await res.text()}`)
  return res.json()
}

async function syncChannel(ch) {
  const today = new Date().toISOString().slice(0, 10)

  // 1. Channel statistics
  const chData = await ytGet('/channels', { part: 'statistics', id: ch.channel_id })
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
  const chInfo = await ytGet('/channels', { part: 'snippet', id: ch.channel_id })
  const snippet = chInfo.items?.[0]?.snippet
  if (snippet && (!ch.title || !ch.handle)) {
    await supabaseAdmin.from('yt_channels').update({
      title: snippet.title || ch.title,
      handle: snippet.customUrl || ch.handle,
    }).eq('id', ch.id)
  }

  // 2. Recent videos (latest 15)
  const searchData = await ytGet('/search', {
    part: 'snippet',
    channelId: ch.channel_id,
    order: 'date',
    maxResults: 15,
    type: 'video',
  })
  const items = searchData.items || []
  if (!items.length) return { ok: true, videos: 0 }

  const videoIds = items.map(v => v.id.videoId).filter(Boolean).join(',')
  if (!videoIds) return { ok: true, videos: 0 }

  // 3. Video statistics
  const vidData = await ytGet('/videos', { part: 'statistics,snippet', id: videoIds })

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
  if (!process.env.YOUTUBE_API_KEY) return { skipped: 'YOUTUBE_API_KEY not configured' }

  const { data: channels, error } = await supabaseAdmin
    .from('yt_channels')
    .select('*')
    .eq('is_active', true)
  if (error) return { error: error.message }
  if (!channels?.length) return { skipped: 'no active yt_channels' }

  const results = []
  for (const ch of channels) {
    try {
      results.push({ channel: ch.channel_id, ...(await syncChannel(ch)) })
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
