import { useEffect, useState } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ChevronDown, ChevronUp, Receipt, ExternalLink } from 'lucide-react'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

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

function getPrevRange(period, customFrom, customTo) {
  const now = new Date()
  if (period === 'month') {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const from = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
    const to = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { from, to }
  }
  return null
}

function fmtEur(v) {
  return Number(v || 0).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// Use the actual visit date for bucketing/sorting; fall back to created_at if older rows
// lack visit_date. This keeps daily bars on the day the work was done, not when entered.
function eventDate(r) {
  return r.visit_date || (r.created_at ? r.created_at.slice(0, 10) : '')
}

const FI_MONTHS = ['Tammi', 'Helmi', 'Maalis', 'Huhti', 'Touko', 'Kesä', 'Heinä', 'Elo', 'Syys', 'Loka', 'Marras', 'Joulu']
const FI_DAYS = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su']

function buildChartData(terapiaRows, valmennusRows, period) {
  if (period === 'year') {
    const map = FI_MONTHS.map(label => ({ label, terapia: 0, valmennus: 0 }))
    terapiaRows.forEach(r => { const d = eventDate(r); if (d) map[new Date(d).getMonth()].terapia += r.price || 0 })
    valmennusRows.forEach(r => { const d = eventDate(r); if (d) map[new Date(d).getMonth()].valmennus += r.price || 0 })
    return map.map(d => ({ ...d, terapia: +d.terapia.toFixed(2), valmennus: +d.valmennus.toFixed(2) }))
  }

  if (period === 'week') {
    const now = new Date(); const dow = now.getDay() || 7
    const slots = {}
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now); d.setDate(now.getDate() - dow + i)
      const key = d.toISOString().slice(0, 10)
      slots[key] = { label: `${FI_DAYS[i - 1]} ${d.getDate()}.`, terapia: 0, valmennus: 0 }
    }
    terapiaRows.forEach(r => { const k = eventDate(r); if (slots[k]) slots[k].terapia += r.price || 0 })
    valmennusRows.forEach(r => { const k = eventDate(r); if (slots[k]) slots[k].valmennus += r.price || 0 })
    return Object.values(slots).map(d => ({ ...d, terapia: +d.terapia.toFixed(2), valmennus: +d.valmennus.toFixed(2) }))
  }

  if (period === 'month') {
    const now = new Date(); const y = now.getFullYear(), m = now.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const slots = {}
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      slots[key] = { label: `${day}.`, terapia: 0, valmennus: 0 }
    }
    terapiaRows.forEach(r => { const k = eventDate(r); if (slots[k]) slots[k].terapia += r.price || 0 })
    valmennusRows.forEach(r => { const k = eventDate(r); if (slots[k]) slots[k].valmennus += r.price || 0 })
    return Object.values(slots).map(d => ({ ...d, terapia: +d.terapia.toFixed(2), valmennus: +d.valmennus.toFixed(2) }))
  }

  // today / custom
  const dayMap = {}
  terapiaRows.forEach(r => {
    const d = eventDate(r); if (!d) return
    if (!dayMap[d]) dayMap[d] = { terapia: 0, valmennus: 0 }
    dayMap[d].terapia += r.price || 0
  })
  valmennusRows.forEach(r => {
    const d = eventDate(r); if (!d) return
    if (!dayMap[d]) dayMap[d] = { terapia: 0, valmennus: 0 }
    dayMap[d].valmennus += r.price || 0
  })
  return Object.entries(dayMap).sort().map(([k, v]) => ({
    label: new Date(k).toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric' }),
    terapia: +v.terapia.toFixed(2),
    valmennus: +v.valmennus.toFixed(2),
  }))
}

function buildCumulativeData(chartData) {
  let cum = 0
  return chartData.map(d => {
    cum += (d.terapia || 0) + (d.valmennus || 0)
    return { label: d.label, kumulatiivinen: +cum.toFixed(2) }
  })
}

function getChartLabel(period) {
  if (period === 'year') return 'kuukausittain'
  if (period === 'week') return 'tämä viikko — päivittäin'
  if (period === 'month') return 'tämä kuukausi — päivittäin'
  if (period === 'today') return 'tänään'
  return ''
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '.5rem .75rem', fontSize: '.78rem' }}>
      <div style={{ color: 'var(--text3)', marginBottom: '.25rem' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {fmtEur(p.value)}</div>
      ))}
    </div>
  )
}

export default function RaportointiOma() {
  const { profile, role } = useAuth()
  const empName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : ''
  const isSport = role === 'sport'
  const isAdmin = role === 'admin' || role === 'manager' || role === 'hallitus'

  const [period, setPeriod] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [terapiaRows, setTerapiaRows] = useState([])
  const [valmennusRows, setValmennusRows] = useState([])
  const [prevTotal, setPrevTotal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showTable, setShowTable] = useState(true)
  const [tableSort, setTableSort] = useState({ col: 'date', dir: 'desc' })
  const [receiptModal, setReceiptModal] = useState(null)

  const [sportRows, setSportRows] = useState([])
  const [sportLoading, setSportLoading] = useState(false)

  useEffect(() => {
    if (empName) fetchData()
  }, [period, customFrom, customTo, empName])

  useEffect(() => {
    if (isSport || isAdmin) fetchSportData()
  }, [isSport, isAdmin])

  async function fetchData() {
    const { from, to } = getRange(period, customFrom, customTo)
    if (!from || !to) return
    setLoading(true)

    // Range filter on visit_date (the actual day of the appointment). Fall back to
    // created_at for legacy rows where visit_date is null.
    const visitFilter = (f, t) =>
      `and(visit_date.gte.${f},visit_date.lte.${t}),and(visit_date.is.null,created_at.gte.${f},created_at.lte.${t}T23:59:59)`

    const [tr, vr] = await Promise.all([
      supabaseAdmin.from('terapiamyynti').select('id, price, service, visit_date, created_at, payment_method, receipt_url')
        .eq('employee_name', empName).or(visitFilter(from, to))
        .order('visit_date', { ascending: true, nullsFirst: true }).order('created_at', { ascending: true }),
      supabaseAdmin.from('valmennusmyynti').select('id, price, service, visit_date, created_at, payment_method, receipt_url')
        .eq('employee_name', empName).or(visitFilter(from, to))
        .order('visit_date', { ascending: true, nullsFirst: true }).order('created_at', { ascending: true }),
    ])
    setTerapiaRows(tr.data || [])
    setValmennusRows(vr.data || [])

    const prev = getPrevRange(period, customFrom, customTo)
    if (prev) {
      const [pt, pv] = await Promise.all([
        supabaseAdmin.from('terapiamyynti').select('price').eq('employee_name', empName).or(visitFilter(prev.from, prev.to)),
        supabaseAdmin.from('valmennusmyynti').select('price').eq('employee_name', empName).or(visitFilter(prev.from, prev.to)),
      ])
      const t = [...(pt.data || []), ...(pv.data || [])].reduce((s, r) => s + (r.price || 0), 0)
      setPrevTotal(t)
    } else {
      setPrevTotal(null)
    }
    setLoading(false)
  }

  async function fetchSportData() {
    setSportLoading(true)
    const { data } = await supabaseAdmin.from('sport_jaakiekko_kesaryhma').select('*').order('syntymavuosi').order('nimi')
    setSportRows((data || []).map(r => {
      const viikot = r.aloitus && r.lopetus
        ? Math.round(Math.max(0, Math.round((new Date(r.lopetus) - new Date(r.aloitus)) / 86400000)) / 7)
        : (r.viikot ?? null)
      const eurNum = parseFloat(r.eur_per_vko)
      const summa = viikot != null && !isNaN(eurNum) ? +(viikot * eurNum).toFixed(2) : (r.summa_yhteensa ?? 0)
      return { ...r, viikot, summa_yhteensa: summa }
    }))
    setSportLoading(false)
  }

  const allRows = [...terapiaRows, ...valmennusRows]
  const total = allRows.reduce((s, r) => s + (r.price || 0), 0)
  const terapiaTotal = terapiaRows.reduce((s, r) => s + (r.price || 0), 0)
  const valmennusTotal = valmennusRows.reduce((s, r) => s + (r.price || 0), 0)
  const avg = allRows.length ? total / allRows.length : 0
  const change = prevTotal != null && prevTotal > 0 ? ((total - prevTotal) / prevTotal * 100) : null

  const chartData = buildChartData(terapiaRows, valmennusRows, period)
  const cumulativeData = buildCumulativeData(chartData)
  const hasChartData = chartData.some(d => d.terapia > 0 || d.valmennus > 0)

  const serviceMap = {}
  allRows.forEach(r => {
    if (!r.service) return
    serviceMap[r.service] = (serviceMap[r.service] || 0) + (r.price || 0)
  })
  const serviceData = Object.entries(serviceMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({
    name: name.length > 20 ? name.slice(0, 18) + '…' : name,
    value: +value.toFixed(2),
  }))

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Raportointi</h1>
          <p className="page-subtitle">{empName || 'Oma myyntiraportti'}</p>
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

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-label">Myynti yhteensä</div>
          <div className="stat-value gold">{loading ? '...' : fmtEur(total)}</div>
          {change !== null && !loading && (
            <div style={{ fontSize: '.72rem', color: change >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginTop: '.25rem' }}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% vs. edellinen kk
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Kirjauksia</div>
          <div className="stat-value">{loading ? '...' : allRows.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Terapiamyynti</div>
          <div className="stat-value" style={{ color: 'var(--violet)' }}>{loading ? '...' : fmtEur(terapiaTotal)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Valmennusmyynti</div>
          <div className="stat-value" style={{ color: 'var(--blue, #3B82F6)' }}>{loading ? '...' : fmtEur(valmennusTotal)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Keskiarvo / kirjaus</div>
          <div className="stat-value">{loading ? '...' : fmtEur(avg)}</div>
        </div>
        {prevTotal != null && (
          <div className="stat-card">
            <div className="stat-label">Edellinen kk</div>
            <div className="stat-value" style={{ color: 'var(--text2)' }}>{loading ? '...' : fmtEur(prevTotal)}</div>
          </div>
        )}
      </div>

      {/* ── Myynnin kehitysgraafi ── */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '.6rem', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>
            Myynnin kehitys
          </h2>
          <span style={{ fontSize: '.72rem', color: 'var(--text3)', fontWeight: 500 }}>
            {getChartLabel(period)}
          </span>
        </div>

        {loading ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '.83rem' }}>
            Ladataan...
          </div>
        ) : !hasChartData ? (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '.83rem' }}>
            Ei myyntiä valitulla aikavälillä.
          </div>
        ) : (
          <>
            {/* Palkkigraafi: terapia + valmennus */}
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} barCategoryGap="25%">
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
                  tickFormatter={v => v === 0 ? '0' : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '.78rem', paddingTop: '.5rem' }} />
                <Bar dataKey="terapia" name="Terapia" fill="var(--violet)" radius={[3, 3, 0, 0]} maxBarSize={40} />
                <Bar dataKey="valmennus" name="Valmennus" fill="#3B82F6" radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>

            {/* Kumulatiivinen kehitysviiva */}
            {cumulativeData.length > 1 && (
              <>
                <div style={{ margin: '1.25rem 0 .75rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem', display: 'flex', alignItems: 'baseline', gap: '.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' }}>Kumulatiivinen kehitys</span>
                  <span style={{ fontSize: '.72rem', color: 'var(--text3)' }}>
                    yhteensä {fmtEur(cumulativeData[cumulativeData.length - 1]?.kumulatiivinen || 0)}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={cumulativeData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <defs>
                      <linearGradient id="gradKum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--violet)" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="var(--violet)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
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
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                      width={36}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="kumulatiivinen"
                      name="Kumulatiivinen"
                      stroke="var(--violet)"
                      strokeWidth={2.5}
                      fill="url(#gradKum)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </>
        )}
      </div>

      {/* Transaction table */}
      {!loading && (() => {
        const combined = [
          ...terapiaRows.map(r => ({ ...r, _type: 'Terapia' })),
          ...valmennusRows.map(r => ({ ...r, _type: 'Valmennus' })),
        ]
        const sortedRows = [...combined].sort((a, b) => {
          if (tableSort.col === 'date') {
            const d = eventDate(a).localeCompare(eventDate(b))
            return tableSort.dir === 'desc' ? -d : d
          }
          if (tableSort.col === 'price') {
            return tableSort.dir === 'desc' ? (b.price || 0) - (a.price || 0) : (a.price || 0) - (b.price || 0)
          }
          return 0
        })
        const toggleSort = (col) => setTableSort(s => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }))
        const SortIcon = ({ col }) => {
          if (tableSort.col !== col) return <span style={{ opacity: .3, fontSize: '.7rem', marginLeft: 3 }}>↕</span>
          return tableSort.dir === 'desc'
            ? <ChevronDown size={12} style={{ marginLeft: 2, verticalAlign: 'middle' }} />
            : <ChevronUp size={12} style={{ marginLeft: 2, verticalAlign: 'middle' }} />
        }
        return (
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showTable ? '1rem' : 0, cursor: 'pointer' }}
              onClick={() => setShowTable(v => !v)}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', margin: 0 }}>
                Myyntikirjaukset ({sortedRows.length} kpl)
              </h3>
              <span style={{ color: 'var(--text3)', fontSize: '.78rem', display: 'flex', alignItems: 'center', gap: '.25rem' }}>
                {showTable ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </span>
            </div>
            {showTable && (
              <div className="table-wrap" style={{ marginTop: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('date')}>
                        Päivämäärä <SortIcon col="date" />
                      </th>
                      <th>Tyyppi</th>
                      <th>Palvelu</th>
                      <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('price')}>
                        Hinta <SortIcon col="price" />
                      </th>
                      <th>Maksutapa</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.length === 0 ? (
                      <tr><td colSpan={6} className="table-empty">Ei kirjauksia valitulla aikavälillä.</td></tr>
                    ) : sortedRows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>
                          {eventDate(r) ? new Date(eventDate(r)).toLocaleDateString('fi-FI') : '—'}
                        </td>
                        <td>
                          <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '.15em .55em', borderRadius: 99,
                            background: r._type === 'Terapia' ? 'var(--violet-subtle, #f5f3ff)' : '#EFF6FF',
                            color: r._type === 'Terapia' ? 'var(--violet)' : '#3B82F6',
                            border: `1px solid ${r._type === 'Terapia' ? 'var(--violet-border, #ddd6fe)' : '#BFDBFE'}` }}>
                            {r._type}
                          </span>
                        </td>
                        <td style={{ fontSize: '.82rem' }}>{r.service || '—'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{(r.price || 0).toFixed(2)} €</td>
                        <td style={{ fontSize: '.78rem', color: 'var(--text3)' }}>{r.payment_method || '—'}</td>
                        <td>
                          {r.receipt_url && (
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
                    ))}
                  </tbody>
                  {sortedRows.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'var(--bg2)', fontWeight: 700 }}>
                        <td colSpan={3}>Yhteensä ({sortedRows.length} kirjausta)</td>
                        <td style={{ color: 'var(--violet)' }}>{sortedRows.reduce((s, r) => s + (r.price || 0), 0).toFixed(2)} €</td>
                        <td /><td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )
      })()}

      {/* Sport – Jääkiekon kesäryhmä */}
      {(isSport || isAdmin) && (
        <div className="card" style={{ marginBottom: '2rem', borderTop: '3px solid #0369a1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.3rem' }}>🏒</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', margin: 0, color: '#0369a1' }}>
              Sport — Jääkiekon kesäryhmä
            </h2>
          </div>

          {sportLoading ? (
            <p style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ladataan...</p>
          ) : (
            <>
              <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
                <div className="stat-card">
                  <div className="stat-label">Pelaajia</div>
                  <div className="stat-value" style={{ color: '#0369a1' }}>{sportRows.length}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Laskutus yhteensä</div>
                  <div className="stat-value gold">{fmtEur(sportRows.reduce((s, r) => s + (r.summa_yhteensa || 0), 0))}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Laskutettu</div>
                  <div className="stat-value" style={{ color: 'var(--green)' }}>
                    {fmtEur(sportRows.filter(r => r.laskutustapa === 'lasku').reduce((s, r) => s + (r.summa_yhteensa || 0), 0))}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Käteinen / kortti</div>
                  <div className="stat-value">
                    {fmtEur(sportRows.filter(r => r.laskutustapa === 'käteinen' || r.laskutustapa === 'kortti').reduce((s, r) => s + (r.summa_yhteensa || 0), 0))}
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Pelaaja</th>
                      <th style={{ textAlign: 'center' }}>S.vuosi</th>
                      <th>Aloitus</th>
                      <th>Lopetus</th>
                      <th style={{ textAlign: 'center' }}>Viikot</th>
                      <th style={{ textAlign: 'right' }}>€/vko</th>
                      <th>Laskutustapa</th>
                      <th>Maksaja</th>
                      <th style={{ textAlign: 'right' }}>Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sportRows.length === 0 ? (
                      <tr><td colSpan={9} className="table-empty">Ei pelaajia kesäryhmässä.</td></tr>
                    ) : sportRows.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.nimi}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '.82rem' }}>{r.syntymavuosi || '—'}</td>
                        <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.aloitus ? new Date(r.aloitus).toLocaleDateString('fi-FI') : '—'}</td>
                        <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.lopetus ? new Date(r.lopetus).toLocaleDateString('fi-FI') : '—'}</td>
                        <td style={{ textAlign: 'center' }}>{r.viikot || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{r.eur_per_vko > 0 ? fmtEur(r.eur_per_vko) : '—'}</td>
                        <td>{r.laskutustapa || '—'}</td>
                        <td>{r.maksaja || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: r.summa_yhteensa > 0 ? '#0369a1' : 'var(--text3)' }}>
                          {r.summa_yhteensa > 0 ? fmtEur(r.summa_yhteensa) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {sportRows.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'var(--bg2)', fontWeight: 700 }}>
                        <td colSpan={8}>Yhteensä ({sportRows.length} pelaajaa)</td>
                        <td style={{ textAlign: 'right', color: '#0369a1' }}>
                          {fmtEur(sportRows.reduce((s, r) => s + (r.summa_yhteensa || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {sportRows.length > 0 && (() => {
                const byMethod = {}
                sportRows.forEach(r => {
                  const m = r.laskutustapa || 'ei määritelty'
                  byMethod[m] = (byMethod[m] || { count: 0, sum: 0 })
                  byMethod[m].count++
                  byMethod[m].sum += r.summa_yhteensa || 0
                })
                return (
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                    {Object.entries(byMethod).sort((a, b) => b[1].sum - a[1].sum).map(([m, v]) => (
                      <div key={m} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.5rem .85rem', fontSize: '.82rem' }}>
                        <div style={{ fontWeight: 700, color: '#0369a1', textTransform: 'capitalize' }}>{m}</div>
                        <div style={{ color: 'var(--text2)' }}>{v.count} pelaajaa · {fmtEur(v.sum)}</div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      )}

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

      {/* Palveluittain + maksutavoittain */}
      {!loading && allRows.length > 0 && (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>Palveluittain</h3>
              {serviceData.map(s => (
                <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '.83rem' }}>
                  <span style={{ color: 'var(--text2)', flex: 1, marginRight: '.5rem' }}>{s.name}</span>
                  <strong style={{ color: 'var(--violet)', flexShrink: 0 }}>{fmtEur(s.value)}</strong>
                </div>
              ))}
              {serviceData.length === 0 && <p style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ei dataa.</p>}
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>Maksutavoittain</h3>
              {(() => {
                const pm = {}
                allRows.forEach(r => { pm[r.payment_method || '—'] = (pm[r.payment_method || '—'] || 0) + (r.price || 0) })
                return Object.entries(pm).sort((a, b) => b[1] - a[1]).map(([m, v]) => (
                  <div key={m} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '.83rem' }}>
                    <span style={{ color: 'var(--text2)' }}>{m}</span>
                    <strong style={{ color: 'var(--text)' }}>{fmtEur(v)}</strong>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
