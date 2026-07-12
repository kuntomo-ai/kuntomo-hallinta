import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CheckSquare, Calendar, Wrench, TrendingUp, BookOpen, Car } from 'lucide-react'

function fmtEur(v) {
  return Number(v || 0).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// ── Tasks Widget ─────────────────────────────────────────────────────────────────
function TasksWidget({ tasks, loading }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <CheckSquare size={15} style={{ color: 'var(--violet)' }} /> Tehtävät
        </h3>
        <Link to="/tasks" style={{ fontSize: '.75rem', color: 'var(--violet)', fontWeight: 600 }}>Kaikki →</Link>
      </div>
      {loading ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ladataan...</p> :
        tasks.length === 0 ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei avoimia tehtäviä.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {tasks.map(t => {
              const urgent = t.priority === 'high'
              const inner = (
                <>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '.4rem', color: urgent ? 'var(--red)' : 'inherit' }}>
                      {urgent && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', flexShrink: 0 }} />}
                      {t.title}
                      {t.link && <span style={{ fontSize: '.7rem', color: 'var(--violet)', flexShrink: 0 }}>→</span>}
                    </div>
                    {t.assigned_to && <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.1rem' }}>{t.assigned_to}</div>}
                  </div>
                  {t.due_date && (
                    <div style={{ fontSize: '.72rem', color: new Date(t.due_date) < new Date() ? 'var(--red)' : 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(t.due_date).toLocaleDateString('fi-FI')}
                    </div>
                  )}
                </>
              )
              const rowStyle = {
                display: 'flex', alignItems: 'flex-start', gap: '.6rem',
                paddingBottom: '.5rem', borderBottom: '1px solid var(--border)',
                textDecoration: 'none', color: 'inherit',
                ...(urgent ? { background: 'color-mix(in srgb, var(--red) 6%, transparent)', borderRadius: 6, padding: '.4rem .5rem' } : {}),
              }
              return t.link
                ? <Link key={t.id} to={t.link} style={{ ...rowStyle, cursor: 'pointer' }}>{inner}</Link>
                : <div key={t.id} style={rowStyle}>{inner}</div>
            })}
          </div>
        )}
    </div>
  )
}

// ── Calendar Widget ──────────────────────────────────────────────────────────────
function CalendarWidget({ events, loading }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <Calendar size={15} style={{ color: 'var(--violet)' }} /> Kalenteri
        </h3>
        <Link to="/calendar" style={{ fontSize: '.75rem', color: 'var(--violet)', fontWeight: 600 }}>Avaa →</Link>
      </div>
      {loading ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ladataan...</p> :
        events.length === 0 ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei tulevia tapahtumia.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {events.map(e => (
              <div key={e.id} style={{ display: 'flex', gap: '.65rem', paddingBottom: '.5rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ background: 'var(--violet-subtle)', border: '1px solid var(--violet-border)', borderRadius: 6, padding: '.2rem .4rem', textAlign: 'center', minWidth: 38, flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1rem', color: 'var(--violet)', lineHeight: 1 }}>{new Date(e.event_start).getDate()}</div>
                  <div style={{ fontSize: '.58rem', color: 'var(--text3)', textTransform: 'uppercase' }}>{new Date(e.event_start).toLocaleDateString('fi-FI', { month: 'short' })}</div>
                </div>
                <div>
                  <div style={{ fontSize: '.85rem', fontWeight: 600 }}>{e.title}</div>
                  {e.category && <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: '.1rem' }}>{e.category}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

// ── Quick Sales Widget ───────────────────────────────────────────────────────────
const TERAPIA_PAY = ['Maksupääte', 'Käteinen', 'Hyvinvointietu', 'Lahjakortti', 'Yrityslaskutus', 'Yrityskäynti', 'Muu']
const VALM_PAY = ['Käteinen', 'Kortti', 'Lasku', 'MobilePay', 'Lahjakortti', 'ePassi']
const VALM_PALVELUT = ['Jatkuva valmennus', 'Fysiikkavalmennus', 'Harjoitusohjelma', 'Harjoitusohjelman päivitys', 'Muu']

function QuickSalesWidget({ profile, user, onSaved }) {
  const [products, setProducts] = useState([])
  const [tab, setTab] = useState('terapia')
  const [tForm, setTForm] = useState({ service: '', price: '', payment: 'Maksupääte' })
  const [vForm, setVForm] = useState({ customer_name: '', service: '', price: '', payment: 'Kortti' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const empName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : null

  useEffect(() => {
    supabaseAdmin.from('hoitotuotteet').select('name, price, category').eq('active', true).order('sort_order').order('name')
      .then(({ data }) => setProducts(data || []))
  }, [])

  async function saveTerapia() {
    if (!tForm.service || !tForm.price) return
    setSaving(true)
    await supabaseAdmin.from('terapiamyynti').insert({
      customer_name: '—',
      service: tForm.service,
      price: parseFloat(tForm.price),
      payment_method: tForm.payment,
      employee_id: user?.id ?? null,
      employee_name: empName || null,
      seller_id: null,
    })
    setSaving(false)
    setTForm({ service: '', price: '', payment: 'Maksupääte' })
    setSaved(true); setTimeout(() => setSaved(false), 2500)
    onSaved && onSaved()
  }

  async function saveValmennus() {
    if (!vForm.customer_name.trim() || !vForm.service || !vForm.price) return
    setSaving(true)
    await supabaseAdmin.from('valmennusmyynti').insert({
      customer_name: vForm.customer_name.trim(),
      service: vForm.service,
      price: parseFloat(vForm.price),
      payment_method: vForm.payment,
      employee_id: user?.id ?? null,
      employee_name: empName || null,
      seller_id: null,
    })
    setSaving(false)
    setVForm({ customer_name: '', service: '', price: '', payment: 'Kortti' })
    setSaved(true); setTimeout(() => setSaved(false), 2500)
    onSaved && onSaved()
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem' }}>Pikamyynti</h3>
        <Link to="/finance/myynti" style={{ fontSize: '.75rem', color: 'var(--violet)', fontWeight: 600 }}>Täysi lomake →</Link>
      </div>
      {saved && <div style={{ background: '#D1FAE5', color: 'var(--green)', fontSize: '.8rem', fontWeight: 700, padding: '.4rem .75rem', borderRadius: 'var(--radius)', marginBottom: '.75rem' }}>✓ Kirjattu!</div>}
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1rem' }}>
        <button className={`sub-tab${tab === 'terapia' ? ' active' : ''}`} style={{ fontSize: '.78rem', padding: '.3rem .7rem' }} onClick={() => setTab('terapia')}>Terapia</button>
        <button className={`sub-tab${tab === 'valmennus' ? ' active' : ''}`} style={{ fontSize: '.78rem', padding: '.3rem .7rem' }} onClick={() => setTab('valmennus')}>Valmennus</button>
      </div>
      {tab === 'terapia' && (
        <div className="form-grid">
          <select className="input-field" value={tForm.service} onChange={e => {
            const p = products.find(x => x.name === e.target.value)
            setTForm(f => ({ ...f, service: e.target.value, price: p?.price > 0 ? String(p.price) : f.price }))
          }}>
            <option value="">Valitse hoitotuote...</option>
            {products.map(p => <option key={p.name} value={p.name}>{p.name}{p.price > 0 ? ` — ${p.price} €` : ''}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <input className="input-field" type="number" step="0.01" min="0" placeholder="Hinta €" style={{ flex: 1 }} value={tForm.price} onChange={e => setTForm(f => ({ ...f, price: e.target.value }))} />
            <select className="input-field" style={{ flex: 1 }} value={tForm.payment} onChange={e => setTForm(f => ({ ...f, payment: e.target.value }))}>
              {TERAPIA_PAY.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={saveTerapia} disabled={saving} style={{ width: '100%' }}>
            {saving ? 'Tallennetaan...' : 'Kirjaa'}
          </button>
        </div>
      )}
      {tab === 'valmennus' && (
        <div className="form-grid">
          <input className="input-field" placeholder="Asiakkaan nimi" value={vForm.customer_name} onChange={e => setVForm(f => ({ ...f, customer_name: e.target.value }))} />
          <select className="input-field" value={vForm.service} onChange={e => setVForm(f => ({ ...f, service: e.target.value }))}>
            <option value="">Valitse palvelu...</option>
            {VALM_PALVELUT.map(s => <option key={s}>{s}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <input className="input-field" type="number" step="0.01" min="0" placeholder="Hinta €" style={{ flex: 1 }} value={vForm.price} onChange={e => setVForm(f => ({ ...f, price: e.target.value }))} />
            <select className="input-field" style={{ flex: 1 }} value={vForm.payment} onChange={e => setVForm(f => ({ ...f, payment: e.target.value }))}>
              {VALM_PAY.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={saveValmennus} disabled={saving} style={{ width: '100%' }}>
            {saving ? 'Tallennetaan...' : 'Kirjaa'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Own Sales Chart Widget ───────────────────────────────────────────────────────
function OwnSalesWidget({ empName, refreshToken }) {
  const [data, setData] = useState({ thisMonth: 0, lastMonth: 0, chartData: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!empName) return
    const now = new Date()
    const thisStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const prevM = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastStart = `${prevM.getFullYear()}-${String(prevM.getMonth() + 1).padStart(2, '0')}-01`
    const lastEnd = thisStart

    Promise.all([
      supabaseAdmin.from('terapiamyynti').select('price, created_at').eq('employee_name', empName).gte('created_at', thisStart),
      supabaseAdmin.from('valmennusmyynti').select('price, created_at').eq('employee_name', empName).gte('created_at', thisStart),
      supabaseAdmin.from('terapiamyynti').select('price').eq('employee_name', empName).gte('created_at', lastStart).lt('created_at', lastEnd),
      supabaseAdmin.from('valmennusmyynti').select('price').eq('employee_name', empName).gte('created_at', lastStart).lt('created_at', lastEnd),
    ]).then(([tr, vr, tlr, vlr]) => {
      const thisRows = [...(tr.data || []), ...(vr.data || [])]
      const thisMonth = thisRows.reduce((s, r) => s + (r.price || 0), 0)
      const lastMonth = [...(tlr.data || []), ...(vlr.data || [])].reduce((s, r) => s + (r.price || 0), 0)
      const dayMap = {}
      thisRows.forEach(r => { const d = new Date(r.created_at).getDate(); dayMap[d] = (dayMap[d] || 0) + (r.price || 0) })
      const chartData = Array.from({ length: now.getDate() }, (_, i) => ({ pvm: i + 1, summa: +(dayMap[i + 1] || 0).toFixed(2) }))
      setData({ thisMonth, lastMonth, chartData })
      setLoading(false)
    })
  }, [empName, refreshToken])

  const change = data.lastMonth > 0 ? ((data.thisMonth - data.lastMonth) / data.lastMonth * 100) : null

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem' }}>Oma myynti</h3>
        <Link to="/finance/raportointi/oma" style={{ fontSize: '.75rem', color: 'var(--violet)', fontWeight: 600 }}>Raportti →</Link>
      </div>
      {loading ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ladataan...</p> : (
        <>
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.2rem' }}>Tämä kuukausi</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--violet)', lineHeight: 1 }}>{fmtEur(data.thisMonth)}</div>
              {change !== null && (
                <div style={{ fontSize: '.72rem', color: change >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginTop: '.2rem' }}>
                  {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% vs. edellinen kk
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: '.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.2rem' }}>Edellinen kk</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text2)' }}>{fmtEur(data.lastMonth)}</div>
            </div>
          </div>
          {data.chartData.some(d => d.summa > 0) && (
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={data.chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="pvm" tick={{ fontSize: 9, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip formatter={v => fmtEur(v)} labelFormatter={l => `Päivä ${l}`} contentStyle={{ fontSize: '.75rem', border: '1px solid var(--border)', background: 'var(--bg)' }} />
                <Bar dataKey="summa" fill="var(--violet)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </div>
  )
}

// ── Quick Timelog Widget ─────────────────────────────────────────────────────────
const WORK_TYPES = ['Normaali', 'Ylityö', 'Sairausloma', 'Loma', 'Koulutus', 'Kokous']

function QuickTimelogWidget({ profile, user }) {
  const TODAY = new Date().toISOString().slice(0, 10)
  const [tab, setTab] = useState('tyoaika')
  const [wForm, setWForm] = useState({ date: TODAY, work_type: 'Normaali', start_time: '', end_time: '' })
  const [dForm, setDForm] = useState({ date: TODAY, distance_km: '', route: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const empName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : ''

  async function saveWork() {
    if (!wForm.work_type) return
    setSaving(true)
    await supabaseAdmin.from('work_logs').insert({
      employee_id: user?.id ?? null, employee_name: empName,
      date: wForm.date, work_type: wForm.work_type,
      start_time: wForm.start_time || null, end_time: wForm.end_time || null,
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
    setWForm({ date: TODAY, work_type: 'Normaali', start_time: '', end_time: '' })
  }

  async function saveDrive() {
    if (!dForm.distance_km) return
    setSaving(true)
    await supabaseAdmin.from('drive_logs').insert({
      driver_name: empName, driver_id: user?.id ?? null,
      drive_date: dForm.date, distance_km: parseFloat(dForm.distance_km), route: dForm.route || null,
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
    setDForm({ date: TODAY, distance_km: '', route: '' })
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <Car size={15} style={{ color: 'var(--violet)' }} /> Pikakirjaus
        </h3>
        <Link to="/timelog" style={{ fontSize: '.75rem', color: 'var(--violet)', fontWeight: 600 }}>Kaikki →</Link>
      </div>
      {saved && <div style={{ background: '#D1FAE5', color: 'var(--green)', fontSize: '.8rem', fontWeight: 700, padding: '.4rem .75rem', borderRadius: 'var(--radius)', marginBottom: '.75rem' }}>✓ Kirjattu!</div>}
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1rem' }}>
        <button className={`sub-tab${tab === 'tyoaika' ? ' active' : ''}`} style={{ fontSize: '.78rem', padding: '.3rem .7rem' }} onClick={() => setTab('tyoaika')}>Työaika</button>
        <button className={`sub-tab${tab === 'ajo' ? ' active' : ''}`} style={{ fontSize: '.78rem', padding: '.3rem .7rem' }} onClick={() => setTab('ajo')}>Ajokirjaus</button>
      </div>
      {tab === 'tyoaika' && (
        <div className="form-grid">
          <input className="input-field" type="date" value={wForm.date} onChange={e => setWForm(f => ({ ...f, date: e.target.value }))} />
          <select className="input-field" value={wForm.work_type} onChange={e => setWForm(f => ({ ...f, work_type: e.target.value }))}>
            {WORK_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <input className="input-field" type="time" style={{ flex: 1 }} value={wForm.start_time} onChange={e => setWForm(f => ({ ...f, start_time: e.target.value }))} />
            <span style={{ alignSelf: 'center', color: 'var(--text3)', fontSize: '.8rem' }}>–</span>
            <input className="input-field" type="time" style={{ flex: 1 }} value={wForm.end_time} onChange={e => setWForm(f => ({ ...f, end_time: e.target.value }))} />
          </div>
          <button className="btn btn-primary" onClick={saveWork} disabled={saving} style={{ width: '100%' }}>
            {saving ? 'Tallennetaan...' : 'Kirjaa työaika'}
          </button>
        </div>
      )}
      {tab === 'ajo' && (
        <div className="form-grid">
          <input className="input-field" type="date" value={dForm.date} onChange={e => setDForm(f => ({ ...f, date: e.target.value }))} />
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <input className="input-field" type="number" step="0.1" min="0" placeholder="km" style={{ flex: 1 }} value={dForm.distance_km} onChange={e => setDForm(f => ({ ...f, distance_km: e.target.value }))} />
            <input className="input-field" placeholder="Reitti (vapaaehtoinen)" style={{ flex: 2 }} value={dForm.route} onChange={e => setDForm(f => ({ ...f, route: e.target.value }))} />
          </div>
          <button className="btn btn-primary" onClick={saveDrive} disabled={saving} style={{ width: '100%' }}>
            {saving ? 'Tallennetaan...' : 'Kirjaa ajo'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Device Alerts Widget ─────────────────────────────────────────────────────────
function DeviceAlertsWidget({ devices, loading }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <Wrench size={15} style={{ color: 'var(--red)' }} /> Huoltopyynnöt
        </h3>
        <Link to="/laiteluettelo" style={{ fontSize: '.75rem', color: 'var(--violet)', fontWeight: 600 }}>Laiteluettelo →</Link>
      </div>
      {loading ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ladataan...</p> :
        devices.length === 0
          ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei avoimia huoltopyyntöjä. ✓</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {devices.slice(0, 4).map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.5rem .75rem', background: '#FFF3F3', border: '1px solid #FECACA', borderRadius: 'var(--radius)' }}>
                  <span style={{ fontSize: '1rem' }}>🔴</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{d.name}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--text3)' }}>{d.sijainti || '—'}{d.category ? ` · ${d.category}` : ''}</div>
                  </div>
                </div>
              ))}
              {devices.length > 4 && <div style={{ fontSize: '.75rem', color: 'var(--text3)', textAlign: 'center' }}>+{devices.length - 4} lisää</div>}
            </div>
          )}
    </div>
  )
}

// ── Reporting Widget ─────────────────────────────────────────────────────────────
function ReportingWidget({ loading, totals }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <TrendingUp size={15} style={{ color: 'var(--violet)' }} /> Raportointi
        </h3>
        <Link to="/finance/raportointi" style={{ fontSize: '.75rem', color: 'var(--violet)', fontWeight: 600 }}>Avaa →</Link>
      </div>
      <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginBottom: '.75rem' }}>Kuluva kuukausi · kaikki myyjät</div>
      {loading ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ladataan...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.1rem' }}>
          {[
            { label: 'Terapia', key: 'terapia', color: 'var(--violet)' },
            { label: 'Valmennus', key: 'valmennus', color: '#3B82F6' },
            { label: 'Jäsenmyynti', key: 'jasen', color: 'var(--orange)' },
            { label: 'Lahjakortit', key: 'lahjakortit', color: 'var(--green)' },
          ].map(c => (
            <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '.83rem', color: 'var(--text2)' }}>{c.label}</span>
              <strong style={{ color: c.color }}>{fmtEur(totals[c.key])}</strong>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.5rem 0', marginTop: '.1rem' }}>
            <span style={{ fontSize: '.83rem', fontWeight: 700 }}>Yhteensä</span>
            <strong style={{ color: 'var(--violet)', fontSize: '1rem' }}>
              {fmtEur(Object.values(totals).reduce((s, v) => s + (v || 0), 0))}
            </strong>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Accounting Widget ────────────────────────────────────────────────────────────
function AccountingWidget({ loading, data }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <BookOpen size={15} style={{ color: 'var(--violet)' }} /> Kirjanpito
        </h3>
        <Link to="/finance/kirjanpito" style={{ fontSize: '.75rem', color: 'var(--violet)', fontWeight: 600 }}>Avaa →</Link>
      </div>
      {loading ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ladataan...</p> :
        !data ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei kirjanpitodataa.</p> : (
          <div className="grid-cols-2" style={{ gap: '.6rem' }}>
            {[
              { label: 'Liikevaihto', value: data.liikevaihto, color: 'var(--gold, #F59E0B)' },
              { label: 'Liikevoitto', value: data.liikevoitto, color: (data.liikevoitto || 0) >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Tilikauden tulos', value: data.fyVoitto, color: (data.fyVoitto || 0) >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Kassavirta', value: data.kassaSaldo, color: (data.kassaSaldo || 0) >= 0 ? 'var(--green)' : 'var(--red)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '.6rem .8rem' }}>
                <div style={{ fontSize: '.63rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.2rem' }}>{s.label}</div>
                <div style={{ fontWeight: 800, fontSize: '.9rem', color: s.color }}>{fmtEur(s.value)}</div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { profile, user, role, isAdmin, isHallitus } = useAuth()

  const isSalesRole = ['myynti', 'terapia_valmennus', 'sport'].includes(role)
  const isHuolto = role === 'huolto'

  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [devices, setDevices] = useState([])
  const [reportingTotals, setReportingTotals] = useState({})
  const [accountingData, setAccountingData] = useState(null)
  const [salesRefreshToken, setSalesRefreshToken] = useState(0)

  const empName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : ''

  useEffect(() => { fetchAll() }, [role])

  async function fetchAll() {
    const now = new Date().toISOString()
    const today = new Date().toISOString().slice(0, 10)

    const baseFetches = [
      supabaseAdmin.from('tasks').select('*')
        .not('status', 'in', '("done","valmis")')
        .or('completed.is.null,completed.eq.false')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(40),
      supabaseAdmin.from('calendar_events').select('*').gte('event_start', today)
        .order('event_start', { ascending: true }).limit(3),
    ]

    if (isHuolto) {
      baseFetches.push(
        supabaseAdmin.from('laiteluettelo_items').select('id, name, sijainti, category').eq('service_requested', true)
      )
    }

    if (isHallitus || isAdmin) {
      const monthStart = new Date().toISOString().slice(0, 7) + '-01'
      baseFetches.push(
        supabaseAdmin.from('terapiamyynti').select('price').gte('created_at', monthStart),
        supabaseAdmin.from('valmennusmyynti').select('price').gte('created_at', monthStart),
        supabaseAdmin.from('jasenmyynti').select('price').gte('created_at', monthStart),
        supabaseAdmin.from('lahjakortit').select('value').gte('created_at', monthStart),
      )
      const fyYear = new Date().getFullYear()
      baseFetches.push(
        supabaseAdmin.from('tulos_kuukausiraportti').select('*')
          .gte('period', `${fyYear - 1}-05`).lte('period', `${fyYear}-04`)
          .order('period', { ascending: false }).limit(12),
        supabaseAdmin.from('kassavirta_entries').select('amount, entry_type').limit(200),
      )
    }

    const results = await Promise.all(baseFetches)
    const rawTasks = results[0].data || []
    const visibleTasks = isAdmin
      ? rawTasks
      : rawTasks.filter(r => {
          const myEmail = profile?.email || ''
          const myRole  = role || ''
          const at = (r.assigned_to || '').trim()
          if (!at) return true
          const parts = at.split(',').map(s => s.trim())
          return at === myEmail || at === empName || parts.some(p => p === myRole)
        })
    // Kiireelliset (high) ylimmäksi, sitten deadline, sitten uusin
    const sorted = [...visibleTasks].sort((a, b) => {
      const ap = a.priority === 'high' ? 0 : 1
      const bp = b.priority === 'high' ? 0 : 1
      if (ap !== bp) return ap - bp
      if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : 1
      if (a.due_date) return -1
      if (b.due_date) return 1
      return (b.created_at || '').localeCompare(a.created_at || '')
    })
    setTasks(sorted.slice(0, 5))
    const allEvents = results[1].data || []
    setEvents(allEvents.filter(e => {
      if (isAdmin || isHallitus) return true
      if (!e.recipient_type || e.recipient_type === 'all') return true
      if (e.recipient_type === 'role' && e.recipient_role === role) return true
      return false
    }))

    let idx = 2
    if (isHuolto) { setDevices(results[idx].data || []); idx++ }

    if (isHallitus || isAdmin) {
      const terapia = (results[idx].data || []).reduce((s, r) => s + (r.price || 0), 0)
      const valmennus = (results[idx + 1].data || []).reduce((s, r) => s + (r.price || 0), 0)
      const jasen = (results[idx + 2].data || []).reduce((s, r) => s + (r.price || 0), 0)
      const lahjakortit = (results[idx + 3].data || []).reduce((s, r) => s + (r.value || 0), 0)
      setReportingTotals({ terapia, valmennus, jasen, lahjakortit })
      idx += 4
      const tulosRows = results[idx].data || []
      const latest = tulosRows[0]
      const fyVoitto = tulosRows.reduce((s, r) => s + (r.tilikauden_voitto || 0), 0)
      const kassaEntries = results[idx + 1].data || []
      const kassaTulot = kassaEntries.filter(r => r.entry_type === 'tulo').reduce((s, r) => s + (r.amount || 0), 0)
      const kassaMenot = kassaEntries.filter(r => r.entry_type === 'meno').reduce((s, r) => s + (r.amount || 0), 0)
      setAccountingData({ liikevaihto: latest?.liikevaihto, liikevoitto: latest?.liikevoitto, fyVoitto, kassaSaldo: kassaTulot - kassaMenot })
    }

    setLoading(false)
  }

  const name = empName || profile?.email || 'käyttäjä'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Hyvää huomenta' : hour < 18 ? 'Hyvää päivää' : 'Hyvää iltaa'

  return (
    <div>
      <div className="welcome-banner">
        <div className="welcome-title">{greeting}, <span>{name}</span> 👋</div>
        <div className="welcome-sub">
          {new Date().toLocaleDateString('fi-FI', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* ── Tasks + Calendar (all roles) ──────────────────────────────────── */}
      <div className="grid-cols-2" style={{ gap: '1.25rem', marginBottom: '1.25rem' }}>
        <TasksWidget tasks={tasks} loading={loading} />
        <CalendarWidget events={events} loading={loading} />
      </div>

      {/* ── Myynti / Terapia_valmennus / Sport ───────────────────────────── */}
      {isSalesRole && (
        <div className="grid-sidebar-main">
          <QuickSalesWidget profile={profile} user={user} onSaved={() => setSalesRefreshToken(t => t + 1)} />
          <OwnSalesWidget empName={empName} refreshToken={salesRefreshToken} />
        </div>
      )}

      {/* ── Huolto ───────────────────────────────────────────────────────── */}
      {isHuolto && (
        <div className="grid-sidebar-main">
          <QuickTimelogWidget profile={profile} user={user} />
          <DeviceAlertsWidget devices={devices} loading={loading} />
        </div>
      )}

      {/* ── Admin ────────────────────────────────────────────────────────── */}
      {isAdmin && (
        <>
          <div style={{ marginBottom: '1.25rem' }}>
            <QuickTimelogWidget profile={profile} user={user} />
          </div>
          <div className="grid-cols-2" style={{ gap: '1.25rem', marginBottom: '1.25rem' }}>
            <ReportingWidget loading={loading} totals={reportingTotals} />
            <AccountingWidget loading={loading} data={accountingData} />
          </div>
        </>
      )}

      {/* ── Hallitus ─────────────────────────────────────────────────────── */}
      {isHallitus && (
        <div className="grid-cols-2" style={{ gap: '1.25rem', marginBottom: '1.25rem' }}>
          <ReportingWidget loading={loading} totals={reportingTotals} />
          <AccountingWidget loading={loading} data={accountingData} />
        </div>
      )}
    </div>
  )
}
