import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ComposedChart, Area,
} from 'recharts'
import { Plus, Edit2, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabaseAdmin } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'

const TODAY = new Date().toISOString().slice(0, 10)

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

const empty = { week_start: getMondayOf(TODAY), new_members: '', ended_members: '', total_members: '', notes: '' }

export default function RaportointiJasenyydet() {
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
    const { data } = await supabaseAdmin.from('membership_stats')
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
      await supabaseAdmin.from('membership_stats').update(payload).eq('id', editRow.id)
    } else {
      await supabaseAdmin.from('membership_stats').insert({ ...payload, created_by: profile?.id || null })
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

  // Monthly chart: weeks in selected month
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

  // Yearly chart: aggregate per month
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

  // Latest stats
  const latest = rows.length > 0 ? rows[rows.length - 1] : null
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const thisMonthRows = rows.filter(r => r.week_start >= monthStart)
  const thisMonthNew = thisMonthRows.reduce((s, r) => s + (r.new_members || 0), 0)
  const thisMonthEnded = thisMonthRows.reduce((s, r) => s + (r.ended_members || 0), 0)

  const chartData = chartView === 'month' ? monthlyData : yearlyData
  const xKey = chartView === 'month' ? 'viikko' : 'kk'

  return (
    <div>
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <NavLink to="/finance/raportointi" end style={{ textDecoration: 'none' }}>
          <button className="sub-tab">← Yhteenveto</button>
        </NavLink>
        <span style={{ color: 'var(--text4)', margin: '0 .2rem' }}>|</span>
        <button className="sub-tab active">Jäsenyydet</button>
      </div>

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Jäsenyydet</h1>
          <p className="page-subtitle">Viikkoseuranta jäsenmääristä</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Lisää viikko</button>
      </div>

      {/* Tilastokortit */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Jäseniä nyt</div>
          <div className="stat-value">{latest?.total_members ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Uudet tässä kk</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>+{thisMonthNew}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Päättyneet tässä kk</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>-{thisMonthEnded}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Nettomuutos tässä kk</div>
          <div className="stat-value" style={{ color: (thisMonthNew - thisMonthEnded) >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {thisMonthNew - thisMonthEnded >= 0 ? '+' : ''}{thisMonthNew - thisMonthEnded}
          </div>
        </div>
      </div>

      {/* Graafi */}
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

      {/* Taulukko */}
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
    </div>
  )
}
