// Instagram API with Instagram Login (graph.instagram.com).
// All endpoints use /me so each call must include the account's own long-lived token.
// Metric names follow Meta's current API. If a metric is rejected the call body
// is returned in raw so the cron can surface the exact error.

const HOST = process.env.IG_API_HOST || 'graph.instagram.com'
const API_VERSION = process.env.IG_API_VERSION || 'v23.0'

class InstagramApiError extends Error {
  constructor(message, { status, code, body } = {}) {
    super(message)
    this.name = 'InstagramApiError'
    this.status = status
    this.code = code
    this.body = body
  }
}

async function igFetch(path, token, params = {}) {
  const url = new URL(`https://${HOST}/${API_VERSION}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v))
  }
  url.searchParams.set('access_token', token)
  let body
  let res
  try {
    res = await fetch(url.toString(), { method: 'GET' })
    body = await res.json()
  } catch (e) {
    throw new InstagramApiError(`Network error calling ${path}: ${e.message}`, { status: 0 })
  }
  if (!res.ok || body.error) {
    const err = body?.error || {}
    throw new InstagramApiError(err.message || `IG API ${res.status} ${path}`, {
      status: res.status,
      code: err.code,
      body,
    })
  }
  return body
}

export async function getProfile(token) {
  return igFetch('/me', token, {
    fields: 'user_id,username,followers_count,follows_count,media_count',
  })
}

// Account-level insights. As of v22+, time-series metrics still accept period=day.
// Some metrics (e.g. follower demographics) require metric_type=total_value and
// would be added separately if needed.
export async function getAccountInsights(token) {
  return igFetch('/me/insights', token, {
    metric: 'reach,profile_views',
    period: 'day',
  })
}

export async function getRecentMedia(token, limit = 25) {
  return igFetch('/me/media', token, {
    fields: 'id,caption,media_type,permalink,thumbnail_url,timestamp',
    limit,
  })
}

// Media-level insights. Note: "impressions" was deprecated in v22 in favor of "views"
// for organic media. "saved" returns total saves.
export async function getMediaInsights(token, mediaId) {
  return igFetch(`/${mediaId}/insights`, token, {
    metric: 'likes,comments,saved,shares,reach,total_interactions,views',
  })
}

// Long-lived tokens last 60 days and can be refreshed any time after they're
// at least 24h old. Returns { access_token, token_type, expires_in }.
export async function refreshToken(token) {
  const url = new URL(`https://${HOST}/refresh_access_token`)
  url.searchParams.set('grant_type', 'ig_refresh_token')
  url.searchParams.set('access_token', token)
  let res, body
  try {
    res = await fetch(url.toString(), { method: 'GET' })
    body = await res.json()
  } catch (e) {
    throw new InstagramApiError(`Network error refreshing token: ${e.message}`, { status: 0 })
  }
  if (!res.ok || body.error) {
    const err = body?.error || {}
    throw new InstagramApiError(err.message || `Refresh failed ${res.status}`, {
      status: res.status,
      code: err.code,
      body,
    })
  }
  return body
}

// Pulls the metric value array out of an /insights response and reduces it to
// a single day's number where applicable. Returns { reach, profile_views, ... }.
export function flattenInsights(insights) {
  const out = {}
  for (const m of insights?.data || []) {
    const v = m?.values?.[m.values.length - 1]?.value
    out[m.name] = typeof v === 'object' ? v : Number(v ?? 0)
  }
  return out
}

export function isTokenError(err) {
  if (!(err instanceof InstagramApiError)) return false
  // Meta uses code 190 for invalid OAuth token; HTTP 401 also indicates it.
  return err.status === 401 || err.code === 190 || err.code === 102
}

export { InstagramApiError }
