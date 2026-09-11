import { useEffect, useState, useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { Receipt } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ReceiptModal from '../../components/ReceiptModal'

const REPORT_NAV = [
  { label: 'Terapiamyynti', to: '/finance/raportointi/terapiamyynti' },
  { label: 'Valmennusmyynti', to: '/finance/raportointi/valmennusmyynti' },
  { label: 'Jäsenmyynti', to: '/finance/raportointi/jasenmyynti' },
  { label: 'Lahjakortit', to: '/finance/raportointi/lahjakortit' },
  { label: 'MobilePay', to: '/finance/raportointi/mobilepay' },
]

function ReportNav() {
  return (
    <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
      <NavLink to="/finance/raportointi" end style={{ textDecoration: 'none' }}>
        <button className="sub-tab">← Yhteenveto</button>
      </NavLink>
      {REPORT_NAV.map(r => (
        <NavLink key={r.to} to={r.to} style={{ textDecoration: 'none' }}>
          {({ isActive }) => <button className={`sub-tab${isActive ? ' active' : ''}`}>{r.label}</button>}
        </NavLink>
      ))}
    </div>
  )
}

const PERIODS = [
  { label: 'Tänään', value: 'today' },
  { label: 'Tällä viikolla', value: 'week' },
  { label: 'Viime kuukausi', value: 'lastmonth' },
  { label: 'Tämä kuukausi', value: 'month' },
  { label: 'Tämä vuosi', value: 'year' },
  { label: 'Mukautettu', value: 'custom' },
]

function getRange(period, customFrom, customTo) {
  const now = new Date()
  if (period === 'today') { const d = now.toISOString().slice(0, 10); return { from: d, to: d } }
  if (period === 'week') {
    const day = now.getDay() || 7
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) }
  }
  if (period === 'lastmonth') {
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const m = now.getMonth() === 0 ? 12 : now.getMonth()
    const last = new Date(y, m, 0).getDate()
    return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${last}` }
  }
  if (period === 'month') {
    return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: now.toISOString().slice(0, 10) }
  }
  if (period === 'year') return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().slice(0, 10) }
  return { from: customFrom, to: customTo }
}

const MONTH_ABBR = ['Tam','Hel','Maa','Huh','Tou','Kes','Hei','Elo','Syy','Lok','Mar','Jou']
function fmtMonth(ym) {
  const [y, m] = ym.split('-')
  return `${MONTH_ABBR[parseInt(m) - 1]} ${y}`
}

export default function RaportointiTerapia() {
  const { user, isAdmin, isHallitus } = useAuth()
  const canFilter = isAdmin || isHallitus

  const [period, setPeriod] = useState('year')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState([])
  const [pivotRows, setPivotRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('list')
  const [receiptModal, setReceiptModal] = useState(null)

  useEffect(() => {
    if (canFilter) {
      Promise.all([
        supabase.from('employees').select('first_name, last_name').order('first_name'),
        supabase.from('terapiamyynti').select('employee_name').not('employee_name', 'is', null),
      ]).then(([empRes, salesRes]) => {
        const fromEmp = (empRes.data || [])
          .map(e => `${e.first_name || ''} ${e.last_name || ''}`.trim())
          .filter(Boolean)
        const fromSales = (salesRes.data || []).map(r => r.employee_name).filter(Boolean)
        const names = [...new Set([...fromEmp, ...fromSales])].sort()
        setEmployees(names)
      })
    }
  }, [canFilter])

  useEffect(() => { fetchData() }, [period, customFrom, customTo, selectedEmployee])

  async function fetchData() {
    const { from, to } = getRange(period, customFrom, customTo)
    if (!from || !to) return
    setLoading(true)

    // List view: server-side employee filter
    let query = supabase.from('terapiamyynti').select('*').gte('entry_date', from).lte('entry_date', to)
    if (selectedEmployee) query = query.eq('employee_name', selectedEmployee)
    const { data } = await query.order('entry_date', { ascending: false })
    setRows(data || [])

    // Pivot view: all employees, paginated
    if (canFilter) {
      let all = []
      let idx = 0
      while (true) {
        const { data: page } = await supabase
          .from('terapiamyynti')
          .select('entry_date, visit_date, created_at, employee_name, price')
          .gte('entry_date', from).lte('entry_date', to)
          .order('entry_date')
          .range(idx, idx + 999)
        if (!page?.length) break
        all = all.concat(page)
        if (page.length < 1000) break
        idx += 1000
      }
      setPivotRows(all)
    }

    setLoading(false)
  }

  const pivotData = useMemo(() => {
    if (!canFilter) return null
    const monthMap = {}
    const empSet = new Set()
    pivotRows.forEach(r => {
      const d = r.entry_date || r.visit_date || r.created_at?.slice(0, 10)
      if (!d) return
      const month = d.slice(0, 7)
      const emp = r.employee_name || '(ei myyjää)'
      empSet.add(emp)
      if (!monthMap[month]) monthMap[month] = {}
      monthMap[month][emp] = (monthMap[month][emp] || 0) + (r.price || 0)
    })
    const sortedMonths = Object.keys(monthMap).sort()
    const sortedEmps = [...empSet].sort()
    const totalsPerEmp = {}
    sortedEmps.forEach(e => {
      totalsPerEmp[e] = sortedMonths.reduce((s, m) => s + (monthMap[m][e] || 0), 0)
    })
    const totalsPerMonth = {}
    sortedMonths.forEach(m => {
      totalsPerMonth[m] = sortedEmps.reduce((s, e) => s + (monthMap[m][e] || 0), 0)
    })
    const grandTotal = sortedEmps.reduce((s, e) => s + totalsPerEmp[e], 0)
    return { monthMap, sortedMonths, sortedEmps, totalsPerEmp, totalsPerMonth, grandTotal }
  }, [pivotRows, canFilter])

  const total = rows.reduce((s, r) => s + (r.price || 0), 0)
  const avg = rows.length ? total / rows.length : 0
  const byService = {}
  rows.forEach(r => { byService[r.service] = (byService[r.service] || 0) + (r.price || 0) })

  return (
    <div>
      <ReportNav />
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Terapiamyynti — Raportti</h1>
          <p className="page-subtitle">
            {viewMode === 'pivot' ? 'Myynti myyjittäin ja kuukausittain' : selectedEmployee ? `Myyjä: ${selectedEmployee}` : 'Terapiapalveluiden myyntiraportti'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          {canFilter && viewMode === 'list' && (
            <select className="input-field" value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} style={{ width: 200 }}>
              <option value="">Kaikki myyjät</option>
              {employees.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          )}
          {canFilter && (
            <div style={{ display: 'flex', gap: '.25rem' }}>
              <button className={`sub-tab${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}>Lista</button>
              <button className={`sub-tab${viewMode === 'pivot' ? ' active' : ''}`} onClick={() => setViewMode('pivot')}>Myyjittäin / kk</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {PERIODS.map(p => (
          <button key={p.value} className={`sub-tab${period === p.value ? ' active' : ''}`} onClick={() => setPeriod(p.value)}>{p.label}</button>
        ))}
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginLeft: '.5rem' }}>
            <input className="input-field" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ width: 150 }} />
            <span style={{ color: 'var(--text3)' }}>–</span>
            <input className="input-field" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ width: 150 }} />
          </div>
        )}
      </div>

      {/* ── Pivot-näkymä ──────────────────────────────────────────────── */}
      {viewMode === 'pivot' && canFilter && (
        <div>
          {loading ? (
            <p style={{ color: 'var(--text3)' }}>Ladataan...</p>
          ) : !pivotData || pivotData.sortedMonths.length === 0 ? (
            <p style={{ color: 'var(--text3)' }}>Ei kirjauksia valitulla aikavälillä.</p>
          ) : (
            <>
              <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="stat-card">
                  <div className="stat-label">Yhteensä</div>
                  <div className="stat-value gold">{pivotData.grandTotal.toFixed(2)} €</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Kuukausia</div>
                  <div className="stat-value">{pivotData.sortedMonths.length}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Myyjiä</div>
                  <div className="stat-value">{pivotData.sortedEmps.length}</div>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text3)', fontWeight: 700, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--bg1)', zIndex: 1 }}>Kuukausi</th>
                      {pivotData.sortedEmps.map(emp => (
                        <th key={emp} style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text2)', fontWeight: 700, whiteSpace: 'nowrap', minWidth: 110 }}>{emp}</th>
                      ))}
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text1)', fontWeight: 800, whiteSpace: 'nowrap' }}>Yhteensä</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivotData.sortedMonths.map((month, i) => (
                      <tr key={month} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--bg1)' : 'var(--bg2)' }}>
                        <td style={{ padding: '7px 12px', fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: i % 2 === 0 ? 'var(--bg1)' : 'var(--bg2)', zIndex: 1 }}>{fmtMonth(month)}</td>
                        {pivotData.sortedEmps.map(emp => {
                          const val = pivotData.monthMap[month][emp] || 0
                          return (
                            <td key={emp} style={{ textAlign: 'right', padding: '7px 10px', color: val > 0 ? 'var(--text1)' : 'var(--text3)' }}>
                              {val > 0 ? val.toFixed(2) + ' €' : '—'}
                            </td>
                          )
                        })}
                        <td style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 700, color: 'var(--violet)' }}>
                          {pivotData.totalsPerMonth[month].toFixed(2)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', background: 'color-mix(in srgb, var(--violet) 6%, var(--bg1))' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 800, textTransform: 'uppercase', fontSize: '.75rem', letterSpacing: '.04em', position: 'sticky', left: 0, background: 'color-mix(in srgb, var(--violet) 6%, var(--bg1))', zIndex: 1 }}>Yhteensä</td>
                      {pivotData.sortedEmps.map(emp => (
                        <td key={emp} style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 700, color: 'var(--violet)' }}>
                          {pivotData.totalsPerEmp[emp].toFixed(2)} €
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', padding: '9px 12px', fontWeight: 900, color: 'var(--violet)', fontSize: '.9rem' }}>
                        {pivotData.grandTotal.toFixed(2)} €
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Lista-näkymä ──────────────────────────────────────────────── */}
      {viewMode === 'list' && (
      <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Yhteensä</div>
          <div className="stat-value gold">{total.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kirjauksia</div>
          <div className="stat-value">{rows.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Keskiarvo / kirjaus</div>
          <div className="stat-value">{avg.toFixed(2)} €</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pvm</th>
                <th>Asiakas</th>
                <th>Palvelu</th>
                <th>Hinta</th>
                <th>Maksutapa</th>
                {canFilter && <th>Myyjä</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canFilter ? 7 : 6} className="table-empty">Ladataan...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={canFilter ? 7 : 6} className="table-empty">Ei kirjauksia valitulla aikavälillä.</td></tr>
              ) : rows.map(r => {
                const canViewReceipt = r.receipt_url && (isAdmin || isHallitus || r.seller_id === user?.id)
                return (
                  <tr key={r.id}>
                    <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>{new Date(r.entry_date || r.visit_date || r.created_at).toLocaleDateString('fi-FI')}</td>
                    <td style={{ fontWeight: 600 }}>{r.customer_name}</td>
                    <td>{r.service}</td>
                    <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{(r.price || 0).toFixed(2)} €</td>
                    <td>{r.payment_method}</td>
                    {canFilter && <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.employee_name || '—'}</td>}
                    <td>
                      {canViewReceipt && (
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Näytä kuitti"
                          onClick={() => setReceiptModal(r.receipt_url)}
                          style={{ color: 'var(--violet)' }}
                        >
                          <Receipt size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>Palveluittain</h3>
          {Object.entries(byService).sort((a, b) => b[1] - a[1]).map(([service, sum]) => (
            <div key={service} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '.83rem' }}>
              <span style={{ color: 'var(--text2)' }}>{service}</span>
              <strong style={{ color: 'var(--violet)' }}>{sum.toFixed(2)} €</strong>
            </div>
          ))}
          {Object.keys(byService).length === 0 && <p style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ei dataa.</p>}
        </div>
      </div>

      <ReceiptModal stored={receiptModal} onClose={() => setReceiptModal(null)} />
      </>
      )}
    </div>
  )
}
