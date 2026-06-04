import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Receipt, ExternalLink } from 'lucide-react'
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

export default function RaportointiTerapia() {
  const { user, isAdmin, isHallitus } = useAuth()
  const canFilter = isAdmin || isHallitus

  const [period, setPeriod] = useState('year')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [receiptModal, setReceiptModal] = useState(null)

  useEffect(() => {
    if (canFilter) {
      Promise.all([
        supabaseAdmin.from('employees').select('first_name, last_name').order('first_name'),
        supabaseAdmin.from('terapiamyynti').select('employee_name').not('employee_name', 'is', null),
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
    let query = supabaseAdmin.from('terapiamyynti').select('*').gte('entry_date', from).lte('entry_date', to)
    if (selectedEmployee) query = query.eq('employee_name', selectedEmployee)
    const { data } = await query.order('entry_date', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

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
            {selectedEmployee ? `Myyjä: ${selectedEmployee}` : 'Terapiapalveluiden myyntiraportti'}
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

      {receiptModal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setReceiptModal(null) }}>
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                <Receipt size={16} /> Kuitti
              </span>
              <a href={receiptModal} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--violet)', fontSize: '.82rem', display: 'flex', alignItems: 'center', gap: '.25rem', textDecoration: 'none' }}>
                Avaa <ExternalLink size={13} />
              </a>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '1rem' }}>
              <img src={receiptModal} alt="Kuitti"
                style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: 6, boxShadow: '0 2px 16px rgba(0,0,0,.12)' }} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setReceiptModal(null)}>Sulje</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
