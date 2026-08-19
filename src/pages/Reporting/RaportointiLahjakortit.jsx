import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

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
  { label: 'Tällä kuulla', value: 'month' },
  { label: 'Tällä vuodella', value: 'year' },
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

function usageBadge(price, used) {
  const remaining = (price || 0) - (used || 0)
  if (remaining <= 0) return <span className="badge badge-gray">Käytetty</span>
  if ((used || 0) > 0) return <span className="badge badge-yellow">Osittain käytetty</span>
  return <span className="badge badge-green">Käyttämättä</span>
}

export default function RaportointiLahjakortit() {
  const [period, setPeriod] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [period, customFrom, customTo])

  async function fetchData() {
    const { from, to } = getRange(period, customFrom, customTo)
    if (!from || !to) return
    setLoading(true)
    const { data } = await supabase
      .from('lahjakortit')
      .select('*')
      .gte('sale_date', from)
      .lte('sale_date', to)
      .order('sale_date', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  const total = rows.reduce((s, r) => s + (r.price || 0), 0)
  const totalUsed = rows.reduce((s, r) => s + (r.used_amount || 0), 0)
  const totalRemaining = total - totalUsed
  const avg = rows.length ? total / rows.length : 0

  const byPaymentMethod = {}
  rows.forEach(r => {
    const k = r.payment_method || 'Tuntematon'
    byPaymentMethod[k] = (byPaymentMethod[k] || 0) + (r.price || 0)
  })

  return (
    <div>
      <ReportNav />
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Lahjakortit — Raportti</h1>
          <p className="page-subtitle">Lahjakorttien myyntiraportti</p>
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

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Myyty yhteensä</div><div className="stat-value gold">{total.toFixed(2)} €</div></div>
        <div className="stat-card"><div className="stat-label">Kortteja</div><div className="stat-value">{rows.length}</div></div>
        <div className="stat-card"><div className="stat-label">Käytetty</div><div className="stat-value">{totalUsed.toFixed(2)} €</div></div>
        <div className="stat-card"><div className="stat-label">Jäljellä</div><div className="stat-value">{totalRemaining.toFixed(2)} €</div></div>
        <div className="stat-card"><div className="stat-label">Keskiarvo / kortti</div><div className="stat-value">{avg.toFixed(2)} €</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem', alignItems: 'start' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Myyty</th><th>Tunnus</th><th>Palvelu</th><th>Arvo</th><th>Käytetty</th><th>Maksutapa</th><th>Tila</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-empty">Ladataan...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="table-empty">Ei kortteja valitulla aikavälillä.</td></tr>
              ) : rows.map(r => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>{r.sale_date ? new Date(r.sale_date).toLocaleDateString('fi-FI') : '—'}</td>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{r.code}</td>
                  <td style={{ color: 'var(--text2)', fontSize: '.83rem' }}>{r.service || '—'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{r.price != null ? r.price.toFixed(2) + ' €' : '—'}</td>
                  <td style={{ color: 'var(--text2)' }}>{(r.used_amount || 0).toFixed(2)} €</td>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.payment_method || '—'}</td>
                  <td>{usageBadge(r.price, r.used_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>Maksutavoittain</h3>
          {Object.entries(byPaymentMethod).sort((a, b) => b[1] - a[1]).map(([method, sum]) => (
            <div key={method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '.83rem' }}>
              <span style={{ color: 'var(--text2)' }}>{method}</span>
              <strong>{sum.toFixed(2)} €</strong>
            </div>
          ))}
          {Object.keys(byPaymentMethod).length === 0 && <p style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ei dataa.</p>}
        </div>
      </div>
    </div>
  )
}
