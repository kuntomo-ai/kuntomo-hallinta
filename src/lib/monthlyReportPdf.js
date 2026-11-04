import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { SALES_EMPLOYEE, WORKTIME_EMPLOYEE } from '../../lib/monthlyReport.js'

export const num = v => parseFloat(v) || 0
export const fiDate = iso => {
  if (!iso) return '—'
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}
export const eur = v => `${num(v).toFixed(2).replace('.', ',')} €`
export const hours = v => `${num(v).toFixed(2).replace('.', ',')} h`
export const clock = v => (v ? String(v).slice(0, 5) : '—')
export const breakText = v => (v ? `${v} min` : '—')
export const membership = r => r.membership_type || r.service || '—'

const TABLE = {
  styles: { fontSize: 9 },
  headStyles: { fillColor: [124, 58, 237] },
  alternateRowStyles: { fillColor: [245, 243, 255] },
  footStyles: { fillColor: [237, 233, 254], textColor: [17, 24, 39], fontStyle: 'bold' },
  showFoot: 'lastPage',
}

function heading(doc, text, y) {
  doc.setFontSize(12)
  doc.text(text, 14, y)
}

function nextY(doc, gap, needed) {
  const y = doc.lastAutoTable.finalY + gap
  if (y + needed < doc.internal.pageSize.getHeight() - 14) return y
  doc.addPage()
  return 16
}

function note(doc, text) {
  doc.setFontSize(9)
  const lines = doc.splitTextToSize(text, 180)
  let y = nextY(doc, 6, 4)
  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - 14) { doc.addPage(); y = 16 }
    doc.text(line, 14, y)
    y += 4
  }
  doc.lastAutoTable.finalY = y
}

export function buildMonthlyReportPdf({ range, worktime, sales, undated }) {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text(`Kuntomo kuukausiraportti: ${range.label}`, 14, 16)

  const totalHours = worktime.reduce((s, r) => s + num(r.hours_total), 0)
  const totalPrice = sales.reduce((s, r) => s + num(r.price), 0)

  heading(doc, `Työaikakirjaukset: ${WORKTIME_EMPLOYEE}`, 27)
  autoTable(doc, {
    ...TABLE,
    startY: 31,
    head: [['Päivä', 'Alkaa', 'Loppuu', 'Tauko', 'Tunnit', 'Muistiinpanot']],
    body: worktime.length
      ? worktime.map(r => [fiDate(r.work_date), clock(r.start_time), clock(r.end_time), breakText(r.break_minutes),
          r.hours_total != null ? hours(r.hours_total) : '—', r.notes || '—'])
      : [['—', '—', '—', '—', '—', 'Ei työaikakirjauksia']],
    foot: [['Yhteensä', '', '', '', hours(totalHours), `${worktime.length} kirjausta`]],
  })
  const missing = worktime.filter(r => r.hours_total == null).length
  if (missing) note(doc, `Huom: ${missing} kirjauksella ei ole tuntimäärää, eikä niitä ole laskettu yhteissummaan.`)

  const salesY = nextY(doc, 10, 30)
  heading(doc, `Jäsenmyynti: ${SALES_EMPLOYEE}`, salesY)
  autoTable(doc, {
    ...TABLE,
    startY: salesY + 4,
    head: [['Alkaa', 'Asiakas', 'Jäsenyys', 'Myyty', 'Hinta']],
    body: sales.length
      ? sales.map(r => [fiDate(r.start_date), r.customer_name || '—',
          r.discount_info ? `${membership(r)} (${r.discount_info})` : membership(r),
          fiDate(r.visit_date || r.created_at), eur(r.price)])
      : [['—', 'Ei kuukauden aikana alkavia jäsenyyksiä', '—', '—', '—']],
    foot: [['Yhteensä', `${sales.length} jäsenyyttä`, '', '', eur(totalPrice)]],
  })
  if (undated.length) {
    note(doc, `Huom: ilman alkamispäivää, ei mukana yhteissummassa: ${undated
      .map(r => `${r.customer_name || '—'} / ${membership(r)} / myyty ${fiDate(r.visit_date)} / ${eur(r.price)}`).join('; ')}`)
  }
  return doc
}
