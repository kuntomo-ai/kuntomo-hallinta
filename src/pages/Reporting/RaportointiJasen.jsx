import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const REPORT_NAV = [
  { label: 'Terapiamyynti', to: '/finance/raportointi/terapiamyynti' },
  { label: 'Valmennusmyynti', to: '/finance/raportointi/valmennusmyynti' },
  { label: 'Jäsenmyynti', to: '/finance/raportointi/jasenmyynti' },
  { label: 'Lahjakortit', to: '/finance/raportointi/lahjakortit' },
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
  if (period === 'month') {
    return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: now.toISOString().slice(0, 10) }
  }
  if (period === 'year') return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().slice(0, 10) }
  return { from: customFrom, to: customTo }
}

export default function RaportointiJasen() {
  const { isAdmin, isHallitus } = useAuth()
  const canFilter = isAdmin || isHallitus

  const [period, setPeriod] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (canFilter) {
      Promise.all([
        supabaseAdmin.from('profiles').select('first_name, last_name').order('first_name'),
        supabaseAdmin.from('jasenmyynti').select('employee_name').not('employee_name', 'is', null),
      ]).then(([profRes, salesRes]) => {
        const fromProfiles = (profRes.data || [])
          .map(p => `${p.first_name || ''} ${p.last_name || ''}`.trim())
          .filter(Boolean)
        const fromSales = (salesRes.data || []).map(r => r.employee_name).filter(Boolean)
        const names = [...new Set([...fromSales, ...fromProfiles])].sort()
        setEmployees(names)
      })
    }
  }, [canFilter])

  useEffect(() => { fetchData() }, [period, customFrom, customTo, selectedEmployee])

  async function fetchData() {
    const { from, to } = getRange(period, customFrom, customTo)
    if (!from || !to) return
    setLoading(true)
    let query = supabaseAdmin.from('jasenmyynti').select('*').gte('created_at', from).lte('created_at', to + 'T23:59:59')
    if (selectedEmployee) query = query.eq('employee_name', selectedEmployee)
    const { data } = await query.order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  const total = rows.reduce((s, r) => s + (r.price || 0), 0)
  const avg = rows.length ? total / rows.length : 0
  const byType = {}
  rows.forEach(r => { byType[r.membership_type] = (byType[r.membership_type] || 0) + (r.price || 0) })

  return (
    <div>
      <ReportNav />
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Jäsenmyynti — Raportti</h1>
          <p className="page-subtitle">
            {selectedEmployee ? `Myyjä: ${selectedEmployee}` : 'Jäsenyyksien myyntiraportti'}
          </p>
        </div>
        {canFilter && (
          <select className="input-field" value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} style={{ width: 200 }}>
            <option value="">Kaikki myyjät</option>
            {employees.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        )}
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

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Yhteensä</div><div className="stat-value gold">{total.toFixed(2)} €</div></div>
        <div className="stat-card"><div className="stat-label">Kirjauksia</div><div className="stat-value">{rows.length}</div></div>
        <div className="stat-card"><div className="stat-label">Keskiarvo / kirjaus</div><div className="stat-value">{avg.toFixed(2)} €</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pvm</th><th>Asiakas</th><th>Jäsenyystyyppi</th><th>Hinta</th><th>Alkaa</th><th>Maksutapa</th>
                {canFilter && <th>Myyjä</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canFilter ? 7 : 6} className="table-empty">Ladataan...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={canFilter ? 7 : 6} className="table-empty">Ei kirjauksia valitulla aikavälillä.</td></tr>
              ) : rows.map(r => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</td>
                  <td style={{ fontWeight: 600 }}>{r.customer_name}</td>
                  <td>{r.membership_type}</td>
                  <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{(r.price || 0).toFixed(2)} €</td>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.start_date ? new Date(r.start_date).toLocaleDateString('fi-FI') : '—'}</td>
                  <td>{r.payment_method}</td>
                  {canFilter && <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.employee_name || '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>Tyypeittäin</h3>
          {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, sum]) => (
            <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '.83rem' }}>
              <span style={{ color: 'var(--text2)' }}>{type}</span>
              <strong style={{ color: 'var(--violet)' }}>{sum.toFixed(2)} €</strong>
            </div>
          ))}
          {Object.keys(byType).length === 0 && <p style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ei dataa.</p>}
        </div>
      </div>
    </div>
  )
}
