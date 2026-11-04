// Yhdistetty päivittäinen cron: kuukausiraportin tehtävä, YouTube, GSC (maanantaisin), Siivous.
import { requireCron } from '../_lib/auth.js'
import { runYtDaily } from './yt-daily.js'
import { runGscWeekly } from './_gsc-weekly.js'
import { runSiivousDaily } from './_siivous-daily.js'
import { createMonthlyReportTask } from './_monthly-report.js'

export default async function handler(req, res) {
  if (!requireCron(req, res)) return

  const isMonday = new Date().getUTCDay() === 1
  const result = { ranAt: new Date().toISOString(), steps: {} }

  // Ensimmäisenä, jotta YouTube-synkan virhe tai aikakatkaisu ei estä tehtävän luontia.
  try {
    result.steps.monthlyReport = await createMonthlyReportTask()
  } catch (err) {
    console.error('[monthly-report]', err)
    result.steps.monthlyReport = { error: err.message }
  }

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

  // Muut vaiheet on ajettu; 500 näkyy Vercelissä epäonnistuneena ajona.
  return res.status(result.steps.monthlyReport.error ? 500 : 200).json(result)
}
