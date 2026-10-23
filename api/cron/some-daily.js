// Yhdistetty SOME-cron: YouTube päivittäin, GSC ja LinkedIn maanantaisin.
// Käyttää samaa CRON_SECRET -autentikointia kuin muut cronit.
import { requireCron } from '../_lib/auth.js'
import { runYtDaily } from './yt-daily.js'
import { runGscWeekly } from './gsc-weekly.js'
import { runLiWeekly } from './li-weekly.js'

export default async function handler(req, res) {
  if (!requireCron(req, res)) return

  const isMonday = new Date().getUTCDay() === 1
  const result = { ranAt: new Date().toISOString(), steps: {} }

  result.steps.youtube = await runYtDaily()

  if (isMonday) {
    result.steps.gsc = await runGscWeekly()
    result.steps.linkedin = await runLiWeekly()
  } else {
    result.steps.gsc = { skipped: 'only on Mondays' }
    result.steps.linkedin = { skipped: 'only on Mondays' }
  }

  return res.status(200).json(result)
}
