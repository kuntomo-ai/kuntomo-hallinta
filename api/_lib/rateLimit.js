// Rate-limit-apuri Upstash Redisillä. Käytetään /api/laite/[id]:ssä ja muissa
// julkisissa/kevyesti autentikoiduissa endpointeissa jotta hyökkääjä ei voi
// spammata tuhansia tehtäviä minuutissa.
//
// Vaatii Vercel-envit:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
// Jos ne puuttuvat → rateLimit palauttaa aina "ok" (fail-open) jotta paikallinen
// dev ei riko. Tuotannossa envit on asetettu, joten limitit ovat voimassa.
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let redis = null
function getRedis() {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

// Cache ratelimiter-instansseja jotta jokaista pyyntöä ei aloiteta tyhjästä
const limiters = new Map()
function getLimiter(name, limit, window) {
  const key = `${name}:${limit}:${window}`
  const cached = limiters.get(key)
  if (cached) return cached
  const r = getRedis()
  if (!r) return null
  const l = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: false,
    prefix: `rl:${name}`,
  })
  limiters.set(key, l)
  return l
}

// Ota client-IP Vercel/Cloudflare-headerista tai fallback socket.
export function clientIp(req) {
  const xff = req.headers?.['x-forwarded-for']
  if (xff) return String(xff).split(',')[0].trim()
  const real = req.headers?.['x-real-ip']
  if (real) return String(real)
  return req.socket?.remoteAddress || 'unknown'
}

// Palauttaa { ok: bool, remaining, limit, reset }.
// Jos Upstash ei ole konfiguroitu → ok=true (fail-open, dev).
export async function rateLimit({ name, key, limit, window }) {
  const l = getLimiter(name, limit, window)
  if (!l) return { ok: true, remaining: limit, limit, reset: 0, skipped: true }
  const res = await l.limit(key)
  return { ok: res.success, remaining: res.remaining, limit: res.limit, reset: res.reset }
}
