// Kuukausiraportin yhteiset määritykset: käytössä sekä cronissa että raporttisivulla.
export const WORKTIME_EMPLOYEE = 'Vilma Puttonen'
export const SALES_EMPLOYEE = 'Eetu Lotvonen'

const MONTHS_FI = ['tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu',
  'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu']

export function getFinnishDate(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Helsinki' }).format(now)
}

export function previousMonth(dateISO) {
  const [y, m] = dateISO.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

// '2026-10' → kuukauden rajat. end on seuraavan kuukauden 1. päivä (ei mukana).
// Palauttaa null, jos kuukausi ei ole muodossa YYYY-MM.
export function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) return null
  const [y, m] = month.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  return { month, start: `${month}-01`, end: `${next}-01`, label: `${MONTHS_FI[m - 1]} ${y}` }
}
