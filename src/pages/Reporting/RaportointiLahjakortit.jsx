import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

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

function statusBadge(status) {
  if (status === 'aktiivinen') return <span className="badge badge-green">Aktiivinen</span>
  if (status === 'käytetty') return <span className="badge badge-gray">Käytetty</span>
  if (status === 'vanhentunut') return <span className="badge badge-red">Vanhentunut</span>
  return <span className="badge badge-gray">{status || '—'}</span>
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
    const { data } = await supabase.from('lahjakortit').select('*').gte('sold_at', from).lte('sold_at', to + 'T23:59:59').order('sold_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  const total = rows.reduce((s, r) => s + (r.value || 0), 0)
  const avg = rows.length ? total / rows.length : 0
  const byStatus = {}
  rows.forEach(r => { byStatus[r.status || 'tuntematon'] = (byStatus[r.status || 'tuntematon'] || 0) + 1 })

  return (
    <div>
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
        <div className="stat-card"><div className="stat-label">Arvo yhteensä</div><div className="stat-value gold">{total.toFixed(2)} €</div></div>
        <div className="stat-card"><div className="stat-label">Kortteja</div><div className="stat-value">{rows.length}</div></div>
        <div className="stat-card"><div className="stat-label">Keskiarvo / kortti</div><div className="stat-value">{avg.toFixed(2)} €</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem', alignItems: 'start' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Myyty</th><th>Tunnus</th><th>Arvo</th><th>Saaja</th><th>Voimassa asti</th><th>Tila</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="table-empty">Ladataan...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="table-empty">Ei kortteja valitulla aikavälillä.</td></tr>
              ) : rows.map(r => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>{r.sold_at ? new Date(r.sold_at).toLocaleDateString('fi-FI') : '—'}</td>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{r.code}</td>
                  <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{r.value != null ? r.value.toFixed(2) + ' €' : '—'}</td>
                  <td>{r.recipient_name || '—'}</td>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.expires_at ? new Date(r.expires_at).toLocaleDateString('fi-FI') : '—'}</td>
                  <td>{statusBadge(r.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>Tiloittain</h3>
          {Object.entries(byStatus).map(([status, count]) => (
            <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '.83rem' }}>
              <span style={{ color: 'var(--text2)' }}>{status}</span>
              <strong>{count} kpl</strong>
            </div>
          ))}
          {Object.keys(byStatus).length === 0 && <p style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ei dataa.</p>}
        </div>
      </div>
    </div>
  )
}
