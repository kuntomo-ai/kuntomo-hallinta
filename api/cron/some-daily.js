// Yhdistetty SOME-cron: YouTube päivittäin, GSC maanantaisin.
import { requireCron } from '../_lib/auth.js'
import { runYtDaily } from './yt-daily.js'
import { runGscWeekly } from './gsc-weekly.js'

export default async function handler(req, res) {
  if (!requireCron(req, res)) return

  const isMonday = new Date().getUTCDay() === 1
  const result = { ranAt: new Date().toISOString(), steps: {} }

  result.steps.youtube = await runYtDaily()

  if (isMonday) {
    result.steps.gsc = await runGscWeekly()
  } else {
    result.steps.gsc = { skipped: 'only on Mondays' }
  }

  return res.status(200).json(result)
}
