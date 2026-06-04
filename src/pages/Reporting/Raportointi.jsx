import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabaseAdmin } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'terapia',   label: 'Terapiamyynti',   table: 'terapiamyynti',   to: '/finance/raportointi/terapiamyynti',   color: 'var(--violet)',            hex: '#7C3AED' },
  { key: 'valmennus', label: 'Valmennusmyynti', table: 'valmennusmyynti', to: '/finance/raportointi/valmennusmyynti', color: '#3B82F6',                   hex: '#3B82F6' },
  { key: 'jasen',     label: 'Jäsenmyynti',     table: 'jasenmyynti',     to: '/finance/raportointi/jasenmyynti',     color: 'var(--orange, #F97316)',    hex: '#F97316' },
]

const PERIODS = [
  { label: 'Tällä viikolla', value: 'week' },
  { label: 'Tämä kuukausi',  value: 'month' },
  { label: 'Tämä vuosi',     value: 'year' },
  { label: 'Mukautettu',     value: 'custom' },
]

const FI_MONTHS = ['Tammi','Helmi','Maalis','Huhti','Touko','Kesä','Heinä','Elo','Syys','Loka','Marras','Joulu']
const FI_DAYS   = ['Ma','Ti','Ke','To','Pe','La','Su']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRange(period, customFrom, customTo) {
  const now = new Date()
  if (period === 'week') {
    const dow = now.getDay() || 7
    const mon = new Date(now); mon.setDate(now.getDate() - dow + 1)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) }
  }
  if (period === 'month') {
    return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to: now.toISOString().slice(0,10) }
  }
  if (period === 'year') return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().slice(0,10) }
  return { from: customFrom, to: customTo }
}

function buildSlots(period) {
  const now = new Date()
  if (period === 'year') {
    return FI_MONTHS.map((label, i) => ({ key: String(i).padStart(2,'0'), label }))
  }
  if (period === 'week') {
    const dow = now.getDay() || 7
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now); d.setDate(now.getDate() - dow + 1 + i)
      return { key: d.toISOString().slice(0,10), label: `${FI_DAYS[i]} ${d.getDate()}.` }
    })
  }
  // month / custom: daily slots for current month
  const y = now.getFullYear(), m = now.getMonth()
  const days = new Date(y, m+1, 0).getDate()
  return Array.from({ length: days }, (_, i) => {
    const day = i + 1
    const key = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return { key, label: `${day}.` }
  })
}

function aggregateRows(rows, period) {
  const map = {}
  rows.forEach(r => {
    const d = (r.created_at || '').slice(0, 10)
    if (!d) return
    let slotKey
    if (period === 'year') {
      slotKey = String(new Date(d).getMonth()).padStart(2,'0')
    } else {
      slotKey = d
    }
    map[slotKey] = (map[slotKey] || 0) + (r.price || 0)
  })
  return map
}

function buildChartData(allRows, period) {
  const slots = buildSlots(period)
  const aggr = {}
  CATEGORIES.forEach(c => { aggr[c.key] = aggregateRows(allRows[c.key] || [], period) })
  return slots.map(slot => {
    const entry = { label: slot.label }
    CATEGORIES.forEach(c => { entry[c.key] = +(aggr[c.key][slot.key] || 0).toFixed(2) })
    return entry
  })
}

function fmtEur(v) {
  return Number(v||0).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '.5rem .75rem', fontSize: '.78rem', minWidth: 160 }}>
      <div style={{ color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 600 }}>{label}</div>
      {payload.map(p => p.value > 0 && (
        <div key={p.dataKey} style={{ color: p.fill, fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>{p.name}</span><span>{fmtEur(p.value)}</span>
        </div>
      ))}
      {payload.length > 1 && total > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: '.3rem', paddingTop: '.3rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--text)' }}>
          <span>Yhteensä</span><span>{fmtEur(total)}</span>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Raportointi() {
  const { isAdmin, isHallitus, role } = useAuth()
  const showMembership = isAdmin || isHallitus || role === 'respa'

  const [period, setPeriod]       = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]   = useState('')
  const [allRows, setAllRows]     = useState({})
  const [memberTotal, setMemberTotal] = useState(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => { fetchData() }, [period, customFrom, customTo, showMembership])

  async function fetchData() {
    const { from, to } = getRange(period, customFrom, customTo)
    if (!from || !to) return
    setLoading(true)

    const results = await Promise.all(
      CATEGORIES.map(c =>
        supabaseAdmin.from(c.table).select('price, created_at')
          .gte('created_at', from).lte('created_at', to + 'T23:59:59')
      )
    )

    const rows = {}
    CATEGORIES.forEach((c, i) => { rows[c.key] = results[i].data || [] })
    setAllRows(rows)

    if (showMembership) {
      const { data } = await supabaseAdmin.from('membership_stats')
        .select('total_members').order('week_start', { ascending: false }).limit(1)
      setMemberTotal(data?.[0]?.total_members ?? null)
    }
    setLoading(false)
  }

  const totals = {}
  CATEGORIES.forEach(c => {
    totals[c.key] = (allRows[c.key] || []).reduce((s, r) => s + (r.price || 0), 0)
  })
  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0)

  const chartData = !loading ? buildChartData(allRows, period) : []
  const hasData   = chartData.some(d => CATEGORIES.some(c => d[c.key] > 0))

  const periodLabel = PERIODS.find(p => p.value === period)?.label || ''

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Raportointi</h1>
          <p className="page-subtitle">Myynnin raportointi ja analytiikka</p>
        </div>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {PERIODS.map(p => (
          <button key={p.value} className={`sub-tab${period === p.value ? ' active' : ''}`} onClick={() => setPeriod(p.value)}>
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginLeft: '.5rem' }}>
            <input className="input-field" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ width: 150 }} />
            <span style={{ color: 'var(--text3)' }}>–</span>
            <input className="input-field" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ width: 150 }} />
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {CATEGORIES.map(c => (
          <Link key={c.key} to={c.to} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', borderTop: `3px solid ${c.color}`, transition: 'box-shadow .15s', height: '100%' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.5rem' }}>{c.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.9rem', color: c.color, lineHeight: 1 }}>
                {loading ? '...' : fmtEur(totals[c.key])}
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.4rem' }}>{periodLabel}</div>
              <div style={{ marginTop: '1rem', fontSize: '.78rem', color: c.color, fontWeight: 600 }}>Avaa raportti →</div>
            </div>
          </Link>
        ))}
        {showMembership && (
          <Link to="/finance/raportointi/jasenyydet" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', borderTop: '3px solid var(--teal, #0D9488)', transition: 'box-shadow .15s', height: '100%' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.5rem' }}>Jäsenyydet</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.9rem', color: 'var(--teal, #0D9488)', lineHeight: 1 }}>
                {loading ? '...' : (memberTotal != null ? memberTotal : '—')}
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.4rem' }}>Viimeisin kirjaus</div>
              <div style={{ marginTop: '1rem', fontSize: '.78rem', color: 'var(--teal, #0D9488)', fontWeight: 600 }}>Avaa raportti →</div>
            </div>
          </Link>
        )}
      </div>

      {/* Charts */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>
            Myynnin kehitys
          </h2>
          <span style={{ fontSize: '.72rem', color: 'var(--text3)' }}>
            {period === 'year' ? 'kuukausittain' : period === 'week' ? 'tämä viikko' : period === 'month' ? 'tämä kuukausi' : 'valittu ajanjakso'}
          </span>
          {!loading && grandTotal > 0 && (
            <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '.9rem', color: 'var(--text)' }}>
              {fmtEur(grandTotal)}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '.83rem' }}>Ladataan...</div>
        ) : !hasData ? (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '.83rem' }}>Ei myyntiä valitulla aikavälillä.</div>
        ) : (
          <>
            {/* Stacked bar chart */}
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: period === 'month' ? 10 : 11, fill: 'var(--text3)' }}
                  tickLine={false}
                  interval={period === 'month' ? 2 : 0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text3)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '.78rem', paddingTop: '.5rem' }} />
                {CATEGORIES.map(c => (
                  <Bar key={c.key} dataKey={c.key} name={c.label} stackId="a" fill={c.hex} maxBarSize={48}
                    radius={c.key === 'jasen' ? [3,3,0,0] : [0,0,0,0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>

            {/* Category breakdown horizontal bars */}
            {grandTotal > 0 && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', marginBottom: '.75rem' }}>
                  Jakaumat
                </div>
                {CATEGORIES.map(c => {
                  const pct = grandTotal > 0 ? (totals[c.key] / grandTotal * 100) : 0
                  return (
                    <div key={c.key} style={{ marginBottom: '.65rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.25rem' }}>
                        <span style={{ fontSize: '.83rem', fontWeight: 600, color: 'var(--text2)' }}>{c.label}</span>
                        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '.78rem', color: 'var(--text3)' }}>{pct.toFixed(1)} %</span>
                          <span style={{ fontSize: '.83rem', fontWeight: 700, color: c.hex, minWidth: 90, textAlign: 'right' }}>{fmtEur(totals[c.key])}</span>
                        </div>
                      </div>
                      <div style={{ height: 7, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: c.hex, borderRadius: 4, transition: 'width .4s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
