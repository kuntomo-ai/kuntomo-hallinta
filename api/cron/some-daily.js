// Yhdistetty päivittäinen cron: YouTube, GSC (maanantaisin), Siivous.
import { requireCron } from '../_lib/auth.js'
import { runYtDaily } from './yt-daily.js'
import { runGscWeekly } from './_gsc-weekly.js'
import { runSiivousDaily } from './_siivous-daily.js'

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

  try {
    result.steps.siivous = await runSiivousDaily()
  } catch (err) {
    console.error('[siivous-daily]', err)
    result.steps.siivous = { error: err.message }
  }

  return res.status(200).json(result)
}
