// Shared bearer auth for Vercel cron endpoints.
// Vercel cron sends Authorization: Bearer ${CRON_SECRET} when calling.
export function requireCron(req, res) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    res.status(500).json({ error: 'CRON_SECRET not configured' })
    return false
  }
  const got = req.headers?.authorization || ''
  if (got !== `Bearer ${expected}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}
