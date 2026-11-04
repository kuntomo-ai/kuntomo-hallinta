import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getFinnishDate, monthRange, previousMonth, SALES_EMPLOYEE, WORKTIME_EMPLOYEE } from '../../../lib/monthlyReport.js'
import { breakText, buildMonthlyReportPdf, clock, eur, fiDate, hours, membership, num } from '../../lib/monthlyReportPdf'

const SALES_COLUMNS = 'customer_name, membership_type, service, discount_info, visit_date, created_at, start_date, price'

async function fetchReport(range) {
  const [worktime, sales, undated] = await Promise.all([
    supabase.from('work_time_logs')
      .select('work_date, start_time, end_time, break_minutes, hours_total, notes')
      .ilike('employee_name', WORKTIME_EMPLOYEE)
      .gte('work_date', range.start).lt('work_date', range.end)
      .order('work_date', { ascending: true }).order('start_time', { ascending: true }),
    supabase.from('jasenmyynti').select(SALES_COLUMNS)
      .ilike('employee_name', SALES_EMPLOYEE)
      .gte('start_date', range.start).lt('start_date', range.end)
      .order('start_date', { ascending: true }).order('customer_name', { ascending: true }),
    // Alkamispäivä ei ole pakollinen, joten ilman sitä oleva myynti ei osuisi mihinkään kuukauteen.
    supabase.from('jasenmyynti').select(SALES_COLUMNS)
      .ilike('employee_name', SALES_EMPLOYEE)
      .is('start_date', null)
      .gte('visit_date', range.start).lt('visit_date', range.end)
      .order('visit_date', { ascending: true }),
  ])
  const failed = worktime.error || sales.error || undated.error
  if (failed) throw new Error(failed.message)
  return { worktime: worktime.data || [], sales: sales.data || [], undated: undated.data || [] }
}

const warningStyle = { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '.6rem .9rem', fontSize: '.82rem', color: 'var(--red)', marginTop: '.75rem' }
const sectionTitle = { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', margin: '1.75rem 0 .75rem' }

export default function RaportointiKuukausi() {
  const [params, setParams] = useSearchParams()
  const month = params.get('month') || previousMonth(getFinnishDate())
  const range = monthRange(month)
  // Tulos sidotaan kuukauteen, jolloin kuukauden vaihto näyttää latauksen eikä edellistä raporttia.
  const [result, setResult] = useState(null)
  const current = result?.month === month ? result : null
  const report = current?.report ?? null
  const error = range ? current?.error ?? '' : 'Virheellinen kuukausi.'

  useEffect(() => {
    if (!range) return
    let cancelled = false
    fetchReport(range)
      .then(data => { if (!cancelled) setResult({ month, report: data }) })
      .catch(err => { if (!cancelled) setResult({ month, error: `Raportin haku epäonnistui: ${err.message}` }) })
    return () => { cancelled = true }
    // range johdetaan month-arvosta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  function downloadPdf() {
    buildMonthlyReportPdf({ range, ...report }).save(`kuntomo_kuukausiraportti_${month}.pdf`)
  }

  const totalHours = (report?.worktime || []).reduce((s, r) => s + num(r.hours_total), 0)
  const totalPrice = (report?.sales || []).reduce((s, r) => s + num(r.price), 0)
  const missingHours = (report?.worktime || []).filter(r => r.hours_total == null).length

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Kuukausiraportti</h1>
          <p className="page-subtitle">{range ? range.label : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input-field" type="month" value={range ? month : ''} style={{ width: 170 }}
            onChange={e => e.target.value && setParams({ month: e.target.value })} />
          <button className="btn btn-primary" onClick={downloadPdf} disabled={!report}>
            <Download size={16} /> Lataa PDF
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <Link to="/finance/raportointi" style={{ fontSize: '.82rem', color: 'var(--violet)' }}>← Raportointi</Link>
      </div>

      {error && <div style={warningStyle}>{error}</div>}
      {!error && !report && <p style={{ color: 'var(--text3)' }}>Ladataan...</p>}

      {report && (
        <>
          <h2 style={sectionTitle}>Työaikakirjaukset: {WORKTIME_EMPLOYEE}</h2>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Tunnit yhteensä</div><div className="stat-value gold">{hours(totalHours)}</div></div>
            <div className="stat-card"><div className="stat-label">Kirjauksia</div><div className="stat-value">{report.worktime.length}</div></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Päivä</th><th>Alkaa</th><th>Loppuu</th><th>Tauko</th><th>Tunnit</th><th>Muistiinpanot</th></tr></thead>
              <tbody>
                {report.worktime.length === 0 ? (
                  <tr><td colSpan={6} className="table-empty">Ei työaikakirjauksia. Jos niitä pitäisi olla, tarkista nimen kirjoitusasu kirjauksissa.</td></tr>
                ) : report.worktime.map((r, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fiDate(r.work_date)}</td>
                    <td>{clock(r.start_time)}</td>
                    <td>{clock(r.end_time)}</td>
                    <td>{breakText(r.break_minutes)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--violet)', whiteSpace: 'nowrap' }}>{r.hours_total != null ? hours(r.hours_total) : '—'}</td>
                    <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {missingHours > 0 && <div style={warningStyle}>{missingHours} kirjauksella ei ole tuntimäärää, eikä niitä ole laskettu yhteissummaan.</div>}

          <h2 style={sectionTitle}>Jäsenmyynti: {SALES_EMPLOYEE}</h2>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Hinnat yhteensä</div><div className="stat-value gold">{eur(totalPrice)}</div></div>
            <div className="stat-card"><div className="stat-label">Alkavia jäsenyyksiä</div><div className="stat-value">{report.sales.length}</div></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Alkaa</th><th>Asiakas</th><th>Jäsenyys</th><th>Myyty</th><th>Hinta</th></tr></thead>
              <tbody>
                {report.sales.length === 0 ? (
                  <tr><td colSpan={5} className="table-empty">Ei kuukauden aikana alkavia jäsenyyksiä. Jos niitä pitäisi olla, tarkista nimen kirjoitusasu kirjauksissa.</td></tr>
                ) : report.sales.map((r, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{fiDate(r.start_date)}</td>
                    <td>{r.customer_name || '—'}</td>
                    <td>{membership(r)}{r.discount_info && <div style={{ fontSize: '.75rem', color: 'var(--text3)' }}>{r.discount_info}</div>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fiDate(r.visit_date || r.created_at)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--violet)', whiteSpace: 'nowrap' }}>{eur(r.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.undated.length > 0 && (
            <div style={warningStyle}>
              Ilman alkamispäivää ({report.undated.length} kpl, ei mukana yhteissummassa):{' '}
              {report.undated.map(r => `${r.customer_name || '—'} / ${membership(r)} / myyty ${fiDate(r.visit_date)} / ${eur(r.price)}`).join('; ')}
            </div>
          )}
        </>
      )}
    </div>
  )
}
