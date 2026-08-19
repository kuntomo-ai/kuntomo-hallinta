import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ComposedChart, Area, AreaChart,
} from 'recharts'
import { Plus, Edit2, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'

const TODAY = new Date().toISOString().slice(0, 10)

const FI_MONTHS_SHORT = ['Tammi','Helmi','Maalis','Huhti','Touko','Kesä','Heinä','Elo','Syys','Loka','Marras','Joulu']

const SALES_TABS = [
  { key: 'kuntosali',    label: 'Kuntosali',     file: '/data/kuntosali.csv',    color: '#3B82F6', productLabel: 'Kuntosalijäsenyys' },
  { key: 'paivajasenyys', label: 'Päiväjäsenyys', file: '/data/paivajasenyys.csv', color: '#F97316', productLabel: 'Päiväjäsenyys' },
  { key: 'kertamaksu',   label: 'Kertamaksu',    file: '/data/kertamaksu.csv',   color: '#0D9488', productLabel: 'Kertamaksu' },
]

function getMondayOf(dateStr) {
  const d = new Date(dateStr)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return d.toISOString().slice(0, 10)
}

function fmtWeek(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric' })
}

function fmtMonth(m) {
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1, 1).toLocaleDateString('fi-FI', { month: 'short', year: '2-digit' })
}

function fmtEur(v) {
  return Number(v || 0).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

const empty = { week_start: getMondayOf(TODAY), new_members: '', ended_members: '', total_members: '', notes: '' }

// ─── CSV parsing (WooCommerce export format) ─────────────────────────────────

function splitCsvLine(line) {
  const out = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuote = false
      else cur += ch
    } else {
      if (ch === '"') inQuote = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out
}

// "25.6.2026 10:53:49" → Date
function parseFiDate(str) {
  if (!str) return null
  const [datePart, timePart = '00:00:00'] = str.trim().split(' ')
  const [d, m, y] = datePart.split('.').map(Number)
  if (!d || !m || !y) return null
  const [hh = 0, mm = 0, ss = 0] = timePart.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, ss)
}

// "35.80  €" → 35.8
function parseEur(str) {
  if (!str) return 0
  const cleaned = String(str).replace(/[^\d,.-]/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

// "1 kpl" → 1
function parseQty(str) {
  if (!str) return 0
  const m = String(str).match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

function parseWooCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return []
  const header = splitCsvLine(lines[0]).map(h => h.trim())
  const idx = {
    order: header.indexOf('Tilaus'),
    person: header.indexOf('Henkilö'),
    date: header.indexOf('Päivämäärä'),
    qty: header.indexOf('Määrä'),
    total: header.indexOf('Hinta yhteensä'),
    status: header.indexOf('Tila'),
  }
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const date = parseFiDate(cells[idx.date])
    if (!date) continue
    const status = (cells[idx.status] || '').trim()
    // Include Maksettu, Käsitelty, Laskutettu — anything not a cancellation
    if (!status || /^(peruttu|peruutus|hylätty|palautettu)$/i.test(status)) continue
    rows.push({
      order: cells[idx.order],
      person: cells[idx.person],
      date,
      qty: parseQty(cells[idx.qty]),
      total: parseEur(cells[idx.total]),
      status,
    })
  }
  return rows
}

// ─── Weekly membership tracking (existing feature) ───────────────────────────

function WeeklyView() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [chartView, setChartView] = useState('month')
  const [chartDate, setChartDate] = useState(new Date())

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('membership_stats')
      .select('*').order('week_start', { ascending: true })
    setRows(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditRow(null)
    setForm({ ...empty, week_start: getMondayOf(TODAY) })
    setShowModal(true)
  }

  function openEdit(r) {
    setEditRow(r)
    setForm({
      week_start: r.week_start,
      new_members: r.new_members ?? '',
      ended_members: r.ended_members ?? '',
      total_members: r.total_members ?? '',
      notes: r.notes || '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.week_start) return
    setSaving(true)
    const payload = {
      week_start: getMondayOf(form.week_start),
      new_members: parseInt(form.new_members) || 0,
      ended_members: parseInt(form.ended_members) || 0,
      total_members: form.total_members !== '' ? parseInt(form.total_members) : null,
      notes: form.notes.trim() || null,
    }
    if (editRow) {
      await supabase.from('membership_stats').update(payload).eq('id', editRow.id)
    } else {
      await supabase.from('membership_stats').insert({ ...payload, created_by: profile?.id || null })
    }
    setSaving(false)
    setShowModal(false)
    await fetchData()
  }

  function navigateChart(dir) {
    const d = new Date(chartDate)
    if (chartView === 'month') d.setMonth(d.getMonth() + dir)
    else d.setFullYear(d.getFullYear() + dir)
    setChartDate(d)
  }

  function chartLabel() {
    if (chartView === 'month')
      return chartDate.toLocaleDateString('fi-FI', { month: 'long', year: 'numeric' })
    return String(chartDate.getFullYear())
  }

  const monthlyData = (() => {
    const y = chartDate.getFullYear()
    const m = chartDate.getMonth()
    return rows
      .filter(r => {
        const d = new Date(r.week_start)
        return d.getFullYear() === y && d.getMonth() === m
      })
      .map(r => ({
        viikko: fmtWeek(r.week_start),
        'Uudet': r.new_members || 0,
        'Päättyneet': r.ended_members || 0,
        'Yhteensä': r.total_members,
      }))
  })()

  const yearlyData = (() => {
    const y = chartDate.getFullYear()
    const map = {}
    rows
      .filter(r => new Date(r.week_start).getFullYear() === y)
      .forEach(r => {
        const d = new Date(r.week_start)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!map[key]) map[key] = { uudet: 0, paattyneet: 0, total: null }
        map[key].uudet += r.new_members || 0
        map[key].paattyneet += r.ended_members || 0
        if (r.total_members != null) map[key].total = r.total_members
      })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
      kk: fmtMonth(k),
      'Uudet': v.uudet,
      'Päättyneet': v.paattyneet,
      'Yhteensä': v.total,
    }))
  })()

  const latest = rows.length > 0 ? rows[rows.length - 1] : null
  const last4 = rows.slice(-4)
  const thisMonthNew = last4.reduce((s, r) => s + (r.new_members || 0), 0)
  const thisMonthEnded = last4.reduce((s, r) => s + (r.ended_members || 0), 0)

  const chartData = chartView === 'month' ? monthlyData : yearlyData
  const xKey = chartView === 'month' ? 'viikko' : 'kk'

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Viikkoseuranta</h1>
          <p className="page-subtitle">Viikoittainen jäsenmäärän kirjaus</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Lisää viikko</button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Jäseniä nyt</div>
          <div className="stat-value">{latest?.total_members ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Uudet viim. 4 vk</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>+{thisMonthNew}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Päättyneet viim. 4 vk</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>-{thisMonthEnded}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Nettomuutos viim. 4 vk</div>
          <div className="stat-value" style={{ color: (thisMonthNew - thisMonthEnded) >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {thisMonthNew - thisMonthEnded >= 0 ? '+' : ''}{thisMonthNew - thisMonthEnded}
          </div>
        </div>
      </div>

      {rows.filter(r => r.total_members != null).length > 1 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1.25rem' }}>
            Jäsenmäärän kehitys
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={rows.filter(r => r.total_members != null).map(r => ({
                pvm: fmtWeek(r.week_start),
                'Jäseniä': r.total_members,
              }))}
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="memberGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--violet)" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="var(--violet)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="pvm" tick={{ fontSize: 10, fill: 'var(--text3)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: '.78rem', border: '1px solid var(--border)', background: 'var(--bg)' }} />
              <Area type="monotone" dataKey="Jäseniä" stroke="var(--violet)" strokeWidth={2.5} fill="url(#memberGrad)" dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '.4rem' }}>
            {['month', 'year'].map(v => (
              <button key={v} className={`sub-tab${chartView === v ? ' active' : ''}`}
                style={{ fontSize: '.8rem', padding: '.3rem .7rem' }}
                onClick={() => { setChartView(v); setChartDate(new Date()) }}>
                {v === 'month' ? 'Kuukausi' : 'Vuosi'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <button onClick={() => navigateChart(-1)} className="btn btn-ghost btn-sm"><ChevronLeft size={14} /></button>
            <span style={{ fontWeight: 600, minWidth: 130, textAlign: 'center', fontSize: '.9rem' }}>{chartLabel()}</span>
            <button onClick={() => navigateChart(1)} className="btn btn-ghost btn-sm"><ChevronRight size={14} /></button>
          </div>
        </div>

        {chartData.length === 0 ? (
          <p style={{ color: 'var(--text3)', fontSize: '.85rem', textAlign: 'center', padding: '2rem 0' }}>Ei dataa valitulle jaksolle.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: '.78rem', border: '1px solid var(--border)', background: 'var(--bg)' }} />
              <Legend wrapperStyle={{ fontSize: '.78rem', paddingTop: '0.5rem' }} />
              <Bar yAxisId="left" dataKey="Uudet" fill="var(--green)" radius={[3, 3, 0, 0]} maxBarSize={40} />
              <Bar yAxisId="left" dataKey="Päättyneet" fill="var(--red)" radius={[3, 3, 0, 0]} maxBarSize={40} />
              <Line yAxisId="right" type="monotone" dataKey="Yhteensä" stroke="var(--violet)" strokeWidth={2} dot={{ r: 4, fill: 'var(--violet)' }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Viikko alkaa</th>
              <th>Uudet</th>
              <th>Päättyneet</th>
              <th>Nettomuutos</th>
              <th>Jäseniä yhteensä</th>
              <th>Muistiinpanot</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-empty">Ladataan...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="table-empty">Ei merkintöjä.</td></tr>
            ) : [...rows].reverse().map(r => {
              const net = (r.new_members || 0) - (r.ended_members || 0)
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{new Date(r.week_start).toLocaleDateString('fi-FI')}</td>
                  <td style={{ color: 'var(--green)', fontWeight: 600 }}>+{r.new_members || 0}</td>
                  <td style={{ color: 'var(--red)', fontWeight: 600 }}>-{r.ended_members || 0}</td>
                  <td style={{ fontWeight: 700, color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {net >= 0 ? '+' : ''}{net}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{r.total_members ?? '—'}</td>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 200 }}>{r.notes || '—'}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><Edit2 size={13} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal
          title={editRow ? `Muokkaa — ${new Date(editRow.week_start).toLocaleDateString('fi-FI')}` : 'Lisää viikkotiedot'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Tallennetaan...' : 'Tallenna'}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Viikon aloituspäivä (maanantai)</label>
              <input className="input-field" type="date" value={form.week_start}
                onChange={e => setForm(f => ({ ...f, week_start: getMondayOf(e.target.value) }))} />
              <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.25rem' }}>
                Valittu viikko alkaa: {form.week_start ? new Date(form.week_start).toLocaleDateString('fi-FI') : '—'}
              </div>
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="input-group">
                <label className="input-label">Uudet jäsenet</label>
                <input className="input-field" type="number" min="0" placeholder="0"
                  value={form.new_members} onChange={e => setForm(f => ({ ...f, new_members: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Päättyneet</label>
                <input className="input-field" type="number" min="0" placeholder="0"
                  value={form.ended_members} onChange={e => setForm(f => ({ ...f, ended_members: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Jäseniä yhteensä</label>
                <input className="input-field" type="number" min="0" placeholder="—"
                  value={form.total_members} onChange={e => setForm(f => ({ ...f, total_members: e.target.value }))} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Muistiinpanot</label>
              <textarea className="input-field" rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── Sales view (Kuntosali / Päiväjäsenyys / Kertamaksu) ────────────────────

function SalesView({ tab }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [chartView, setChartView] = useState('year')
  const [chartDate, setChartDate] = useState(new Date())

  useEffect(() => {
    let cancelled = false
    fetch(tab.file)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then(text => {
        if (cancelled) return
        const parsed = parseWooCsv(text)
        parsed.sort((a, b) => a.date - b.date)
        setRows(parsed)
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message || 'Virhe ladattaessa dataa')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [tab.file])

  // Aggregate: revenue + count per month across all data
  const monthlyAll = useMemo(() => {
    const map = new Map()
    rows.forEach(r => {
      const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`
      const entry = map.get(key) || { key, revenue: 0, count: 0 }
      entry.revenue += r.total
      entry.count += 1
      map.set(key, entry)
    })
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
  }, [rows])

  // Aggregate: revenue + count per year
  const yearlyAll = useMemo(() => {
    const map = new Map()
    rows.forEach(r => {
      const y = r.date.getFullYear()
      const entry = map.get(y) || { year: y, revenue: 0, count: 0 }
      entry.revenue += r.total
      entry.count += 1
      map.set(y, entry)
    })
    return [...map.values()].sort((a, b) => a.year - b.year)
  }, [rows])

  const chartData = useMemo(() => {
    if (chartView === 'year') {
      // Months of selected year (fill blanks with 0)
      const y = chartDate.getFullYear()
      return FI_MONTHS_SHORT.map((label, i) => {
        const key = `${y}-${String(i + 1).padStart(2, '0')}`
        const entry = monthlyAll.find(m => m.key === key)
        return {
          label,
          Myynti: entry ? +entry.revenue.toFixed(2) : 0,
          Kappaleet: entry ? entry.count : 0,
        }
      })
    }
    // 'all' — every month
    return monthlyAll.map(m => ({
      label: fmtMonth(m.key),
      Myynti: +m.revenue.toFixed(2),
      Kappaleet: m.count,
    }))
  }, [chartView, chartDate, monthlyAll])

  function navigateChart(dir) {
    if (chartView !== 'year') return
    const d = new Date(chartDate); d.setFullYear(d.getFullYear() + dir); setChartDate(d)
  }

  const availableYears = useMemo(() => [...new Set(yearlyAll.map(y => y.year))], [yearlyAll])

  // Stats: current month, current year, all time
  const now = new Date()
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const curMonth = monthlyAll.find(m => m.key === curKey)
  const curYear = yearlyAll.find(y => y.year === now.getFullYear())
  const totals = rows.reduce((a, r) => ({ revenue: a.revenue + r.total, count: a.count + 1 }), { revenue: 0, count: 0 })

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{tab.label}</h1>
          <p className="page-subtitle">{tab.productLabel} — verkkokaupan myyntitilaukset</p>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)', marginBottom: '1.5rem' }}>
          Virhe: {error}
        </div>
      )}

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Tämä kuukausi</div>
          <div className="stat-value" style={{ color: tab.color }}>{loading ? '...' : fmtEur(curMonth?.revenue || 0)}</div>
          <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.25rem' }}>
            {loading ? '' : `${curMonth?.count || 0} tilausta`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tämä vuosi</div>
          <div className="stat-value" style={{ color: tab.color }}>{loading ? '...' : fmtEur(curYear?.revenue || 0)}</div>
          <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.25rem' }}>
            {loading ? '' : `${curYear?.count || 0} tilausta`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Yhteensä</div>
          <div className="stat-value">{loading ? '...' : fmtEur(totals.revenue)}</div>
          <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.25rem' }}>
            {loading ? '' : `${totals.count} tilausta`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Keskikauppa</div>
          <div className="stat-value">{loading || !totals.count ? '—' : fmtEur(totals.revenue / totals.count)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem' }}>
            Myynti kuukausittain
          </div>
          <div style={{ display: 'flex', gap: '.4rem', marginLeft: 'auto' }}>
            {['year', 'all'].map(v => (
              <button key={v} className={`sub-tab${chartView === v ? ' active' : ''}`}
                style={{ fontSize: '.8rem', padding: '.3rem .7rem' }}
                onClick={() => { setChartView(v); if (v === 'year') setChartDate(new Date()) }}>
                {v === 'year' ? 'Vuosi' : 'Koko historia'}
              </button>
            ))}
          </div>
          {chartView === 'year' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <button onClick={() => navigateChart(-1)} className="btn btn-ghost btn-sm"><ChevronLeft size={14} /></button>
              <span style={{ fontWeight: 600, minWidth: 60, textAlign: 'center', fontSize: '.9rem' }}>{chartDate.getFullYear()}</span>
              <button onClick={() => navigateChart(1)} className="btn btn-ghost btn-sm"><ChevronRight size={14} /></button>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '.85rem' }}>Ladataan...</div>
        ) : chartData.length === 0 || chartData.every(d => !d.Myynti) ? (
          <p style={{ color: 'var(--text3)', fontSize: '.85rem', textAlign: 'center', padding: '2rem 0' }}>Ei myyntiä valitulle jaksolle.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false}
                interval={chartView === 'all' && chartData.length > 24 ? Math.ceil(chartData.length / 12) : 0} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={40} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} width={30} />
              <Tooltip
                contentStyle={{ fontSize: '.78rem', border: '1px solid var(--border)', background: 'var(--bg)' }}
                formatter={(value, name) => name === 'Myynti' ? fmtEur(value) : `${value} kpl`}
              />
              <Legend wrapperStyle={{ fontSize: '.78rem', paddingTop: '0.5rem' }} />
              <Bar yAxisId="left" dataKey="Myynti" fill={tab.color} radius={[3, 3, 0, 0]} maxBarSize={48} />
              <Line yAxisId="right" type="monotone" dataKey="Kappaleet" stroke="var(--violet)" strokeWidth={2} dot={{ r: 3, fill: 'var(--violet)' }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {availableYears.length > 1 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1.25rem' }}>
            Vuositason yhteenveto
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Vuosi</th><th style={{ textAlign: 'right' }}>Tilauksia</th><th style={{ textAlign: 'right' }}>Myynti</th><th style={{ textAlign: 'right' }}>Keskikauppa</th></tr>
              </thead>
              <tbody>
                {[...yearlyAll].reverse().map(y => (
                  <tr key={y.year}>
                    <td style={{ fontWeight: 600 }}>{y.year}</td>
                    <td style={{ textAlign: 'right' }}>{y.count}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: tab.color }}>{fmtEur(y.revenue)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text3)' }}>{fmtEur(y.revenue / y.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tilaus</th>
              <th>Päivämäärä</th>
              <th style={{ textAlign: 'right' }}>Määrä</th>
              <th style={{ textAlign: 'right' }}>Hinta</th>
              <th>Tila</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="table-empty">Ladataan...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">Ei tilauksia.</td></tr>
            ) : [...rows].reverse().slice(0, 100).map(r => (
              <tr key={r.order}>
                <td style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '.8rem' }}>#{r.order}</td>
                <td>{r.date.toLocaleDateString('fi-FI')}</td>
                <td style={{ textAlign: 'right' }}>{r.qty}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtEur(r.total)}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length > 100 && (
          <div style={{ padding: '.75rem', textAlign: 'center', fontSize: '.78rem', color: 'var(--text3)' }}>
            Näytetään uusimmat 100 / {rows.length} tilausta
          </div>
        )}
      </div>
    </>
  )
}

// ─── Main page with tabs ────────────────────────────────────────────────────

export default function RaportointiJasenyydet() {
  const [tab, setTab] = useState('viikko')
  const activeSalesTab = SALES_TABS.find(t => t.key === tab)

  return (
    <div>
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <NavLink to="/finance/raportointi" end style={{ textDecoration: 'none' }}>
          <button className="sub-tab">← Yhteenveto</button>
        </NavLink>
        <span style={{ color: 'var(--text4)', margin: '0 .2rem' }}>|</span>
        <button className={`sub-tab${tab === 'viikko' ? ' active' : ''}`} onClick={() => setTab('viikko')}>Viikkoseuranta</button>
        {SALES_TABS.map(t => (
          <button key={t.key} className={`sub-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'viikko' ? <WeeklyView /> : activeSalesTab && <SalesView key={activeSalesTab.key} tab={activeSalesTab} />}
    </div>
  )
}
