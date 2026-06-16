// Single daily cron for Vercel Hobby tier — sync + analyze every day,
// token-refresh weekly (only on Mondays, since tokens expire after 60 days
// and we refresh within a 14-day window).
import { requireCron } from '../_lib/auth.js'
import syncHandler from './ig-sync.js'
import refreshHandler from './ig-token-refresh.js'
import analyzeHandler from './ig-analyze.js'

// Capture a sub-handler's JSON response without sending it to the real client.
async function capture(handler, req) {
  let status = 200
  let body = null
  const fakeRes = {
    status(s) { status = s; return this },
    json(b) { body = b; return this },
  }
  await handler(req, fakeRes)
  return { status, body }
}

export default async function handler(req, res) {
  if (!requireCron(req, res)) return

  // Use UTC weekday to match Vercel's cron clock (UTC).
  const weekday = new Date().getUTCDay() // 0=Sun, 1=Mon
  const isMonday = weekday === 1

  const result = { ranAt: new Date().toISOString(), weekday, steps: {} }

  result.steps.sync = await capture(syncHandler, req)
  result.steps.analyze = await capture(analyzeHandler, req)

  if (isMonday) {
    result.steps.tokenRefresh = await capture(refreshHandler, req)
  } else {
    result.steps.tokenRefresh = { skipped: 'only on Mondays' }
  }

  res.status(200).json(result)
}
