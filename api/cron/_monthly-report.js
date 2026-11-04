// Luo kuukauden alussa admin-tehtävän, josta edellisen kuukauden raportti avataan.
// Ajetaan päivittäin some-daily.js:n kautta (0 3 * * * UTC = klo 5–6 Helsinki).
// _-etuliite: Vercel Hobbyn 12 funktion kiintiö on täynnä, joten tämä ei ole oma funktio.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'
import { getFinnishDate, monthRange, previousMonth } from '../../lib/monthlyReport.js'

// Kuukauden viiden ensimmäisen päivän aikana, jotta väliin jäänyt cron-ajo korjautuu
// seuraavana päivänä. Tehtävän otsikko estää tuplat.
const LAST_DAY_TO_CREATE = 5

export async function createMonthlyReportTask(now = new Date()) {
  const today = getFinnishDate(now)
  if (Number(today.slice(8, 10)) > LAST_DAY_TO_CREATE) {
    return { skipped: `only on days 1-${LAST_DAY_TO_CREATE} of the month` }
  }

  const range = monthRange(previousMonth(today))
  const title = `Kuukausiraportti: ${range.label}`

  const { data: existing, error: findError } = await supabaseAdmin
    .from('tasks').select('id').eq('title', title).limit(1)
  if (findError) throw new Error(findError.message)
  if (existing.length) return { skipped: 'task already exists', title }

  const link = `/finance/raportointi/kuukausiraportti?month=${range.month}`
  const task = {
    title,
    description: 'Vilma Puttosen työajat ja Eetu Lotvosen jäsenmyynnit. Raportti löytyy myös sivulta Raportointi → Kuukausiraportti.',
    status: 'avoin',
    priority: 'high', // etusivun lista näyttää vain kärkipään, joten normaali tehtävä voisi jäädä piiloon
    created_by: 'Järjestelmä',
    assigned_to: 'admin',
  }
  const { error } = await supabaseAdmin.from('tasks').insert({ ...task, link })
  if (error) {
    // Sama varalla kuin api/laite/[id].js: tehtävä ilman linkkiä, jos sarake puuttuu.
    const { error: retryError } = await supabaseAdmin.from('tasks').insert(task)
    if (retryError) throw new Error(retryError.message)
  }
  return { created: true, title, link }
}
