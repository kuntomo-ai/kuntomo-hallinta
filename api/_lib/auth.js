// Shared bearer auth for Vercel cron endpoints.
// Vercel cron sends Authorization: Bearer ${CRON_SECRET} when calling.
import { timingSafeEqual } from 'crypto'

export function requireCron(req, res) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    res.status(500).json({ error: 'CRON_SECRET not configured' })
    return false
  }
  const got = req.headers?.authorization || ''
  const want = `Bearer ${expected}`
  let match = false
  try {
    const a = Buffer.from(got)
    const b = Buffer.from(want)
    match = a.length === b.length && timingSafeEqual(a, b)
  } catch {
    match = false
  }
  if (!match) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}
