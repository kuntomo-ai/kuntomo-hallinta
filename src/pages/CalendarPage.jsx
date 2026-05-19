import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/ui/Modal'

// ─── Kalenteri tab ────────────────────────────────────────────────────────────

const CATEGORIES = ['tapahtuma', 'kampanja', 'koulutus', 'muu']
const CAT_COLORS = { tapahtuma: 'var(--violet)', kampanja: 'var(--orange)', koulutus: 'var(--blue)', muu: 'var(--green)' }
const CAT_BG = { tapahtuma: 'var(--violet-subtle)', kampanja: 'var(--orange-subtle)', koulutus: 'var(--blue-subtle)', muu: 'var(--green-subtle)' }

const emptyEvent = { title: '', category: 'tapahtuma', start_date: '', end_date: '', description: '' }

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfMonth(year, month) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

const MONTH_NAMES = ['Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu', 'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu']
const MONTH_SHORT = ['Tam', 'Hel', 'Maa', 'Huh', 'Tou', 'Kes', 'Hei', 'Elo', 'Syy', 'Lok', 'Mar', 'Jou']
const DAY_NAMES = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su']

function KalenteriTab() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyEvent)
  const [saving, setSaving] = useState(false)
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('calendar_events').select('*').order('start_date', { ascending: true })
    setEvents(data || [])
    setLoading(false)
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  async function handleSave() {
    if (!form.title.trim() || !form.start_date) return
    setSaving(true)
    await supabase.from('calendar_events').insert({
      title: form.title.trim(),
      category: form.category,
      start_date: form.start_date,
      end_date: form.end_date || form.start_date,
      description: form.description.trim() || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm(emptyEvent)
    fetchData()
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const eventsByDay = {}
  events.forEach(e => {
    const start = e.start_date?.slice(0, 10)
    const end = (e.end_date || e.start_date)?.slice(0, 10)
    if (!start) return
    let cur = new Date(start)
    const endDate = new Date(end)
    while (cur <= endDate) {
      const key = cur.toISOString().slice(0, 10)
      if (!eventsByDay[key]) eventsByDay[key] = []
      eventsByDay[key].push(e)
      cur.setDate(cur.getDate() + 1)
    }
  })

  const upcomingEvents = events.filter(e => e.start_date >= new Date().toISOString()).slice(0, 10)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={() => { setForm(emptyEvent); setShowModal(true) }}>
          <Plus size={16} /> Uusi tapahtuma
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem', alignItems: 'start' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={prevMonth}><ChevronLeft size={16} /></button>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem' }}>{MONTH_NAMES[month]} {year}</h3>
            <button className="btn btn-ghost btn-sm" onClick={nextMonth}><ChevronRight size={16} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '.65rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', padding: '.4rem 0' }}>{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEvents = eventsByDay[dateStr] || []
              const isToday = dateStr === today.toISOString().slice(0, 10)
              return (
                <div key={day} style={{ minHeight: 72, borderRadius: 6, padding: '4px 5px', background: isToday ? 'var(--violet-subtle)' : 'var(--bg2)', border: isToday ? '1px solid var(--violet-border)' : '1px solid transparent' }}>
                  <div style={{ fontSize: '.72rem', fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--violet)' : 'var(--text2)', marginBottom: 2 }}>{day}</div>
                  {dayEvents.slice(0, 3).map(ev => (
                    <div key={ev.id} title={ev.title} style={{ fontSize: '.62rem', fontWeight: 600, background: CAT_BG[ev.category] || 'var(--bg3)', color: CAT_COLORS[ev.category] || 'var(--text3)', borderRadius: 3, padding: '1px 4px', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && <div style={{ fontSize: '.58rem', color: 'var(--text4)' }}>+{dayEvents.length - 3}</div>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '1rem' }}>Tulevat tapahtumat</h3>
          {loading ? (
            <p style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ladataan...</p>
          ) : upcomingEvents.length === 0 ? (
            <p style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ei tulevia tapahtumia.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              {upcomingEvents.map(e => (
                <div key={e.id} style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start', paddingBottom: '.75rem', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: CAT_COLORS[e.category] || 'var(--text3)', marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '.83rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: '.15rem' }}>
                      {new Date(e.start_date).toLocaleDateString('fi-FI')}
                      {e.end_date && e.end_date !== e.start_date && ` – ${new Date(e.end_date).toLocaleDateString('fi-FI')}`}
                    </div>
                    <span style={{ fontSize: '.65rem', color: CAT_COLORS[e.category] || 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{e.category}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <Modal title="Uusi tapahtuma" onClose={() => setShowModal(false)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Otsikko</label>
              <input className="input-field" name="title" placeholder="Tapahtuman nimi" value={form.title} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Kategoria</label>
              <select className="input-field" name="category" value={form.category} onChange={handleChange}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Alkaa</label>
                <input className="input-field" name="start_date" type="date" value={form.start_date} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Loppuu</label>
                <input className="input-field" name="end_date" type="date" value={form.end_date} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Kuvaus</label>
              <textarea className="input-field" name="description" rows={3} value={form.description} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── Vuosikello (Markkinointikalenteri) ───────────────────────────────────────

const ALUEET = [
  { key: 'kuntosali', label: 'Kuntosali', color: '#7a0251' },
  { key: 'hieronta', label: 'Hieronta & Fysioterapia', color: '#c2410c' },
  { key: 'valmennus', label: 'Valmennus', color: '#0369a1' },
]

const emptyMark = { title: '', alue: ALUEET[0].key, month: String(new Date().getMonth() + 1), description: '' }

function Vuosikello({ events, onClickMonth }) {
  const cx = 200, cy = 200, r = 155

  return (
    <svg viewBox="0 0 400 400" style={{ width: '100%', maxWidth: 420 }}>
      {/* Month segments */}
      {MONTH_SHORT.map((name, i) => {
        const startAngle = (i * 30 - 90) * Math.PI / 180
        const endAngle = ((i + 1) * 30 - 90) * Math.PI / 180
        const midAngle = ((i * 30 + 15) - 90) * Math.PI / 180

        const x1 = cx + r * Math.cos(startAngle)
        const y1 = cy + r * Math.sin(startAngle)
        const x2 = cx + r * Math.cos(endAngle)
        const y2 = cy + r * Math.sin(endAngle)

        const lx = cx + (r - 22) * Math.cos(midAngle)
        const ly = cy + (r - 22) * Math.sin(midAngle)

        const isCurrentMonth = i === new Date().getMonth()

        return (
          <g key={i} onClick={() => onClickMonth(i + 1)} style={{ cursor: 'pointer' }}>
            <path
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
              fill={isCurrentMonth ? '#f5e6f0' : '#f9fafb'}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 9, fontWeight: isCurrentMonth ? 800 : 600, fill: isCurrentMonth ? '#7a0251' : '#6b7280', fontFamily: 'system-ui' }}>
              {name}
            </text>
          </g>
        )
      })}

      {/* Inner rings for each alue */}
      {ALUEET.map((alue, ai) => {
        const innerR = 55 + ai * 28
        const outerR = 55 + ai * 28 + 24

        const monthEvents = {}
        events.filter(e => e.alue === alue.key).forEach(e => {
          const m = parseInt(e.month)
          if (!monthEvents[m]) monthEvents[m] = []
          monthEvents[m].push(e)
        })

        return Array.from({ length: 12 }, (_, i) => {
          const startAngle = (i * 30 - 90) * Math.PI / 180
          const endAngle = ((i + 1) * 30 - 90) * Math.PI / 180
          const midAngle = ((i * 30 + 15) - 90) * Math.PI / 180

          const ix1 = cx + innerR * Math.cos(startAngle)
          const iy1 = cy + innerR * Math.sin(startAngle)
          const ox1 = cx + outerR * Math.cos(startAngle)
          const oy1 = cy + outerR * Math.sin(startAngle)
          const ix2 = cx + innerR * Math.cos(endAngle)
          const iy2 = cy + innerR * Math.sin(endAngle)
          const ox2 = cx + outerR * Math.cos(endAngle)
          const oy2 = cy + outerR * Math.sin(endAngle)

          const hasEvents = (monthEvents[i + 1] || []).length > 0
          const count = (monthEvents[i + 1] || []).length

          const lx = cx + (innerR + 12) * Math.cos(midAngle)
          const ly = cy + (innerR + 12) * Math.sin(midAngle)

          return (
            <g key={`${alue.key}-${i}`} onClick={() => onClickMonth(i + 1, alue.key)} style={{ cursor: 'pointer' }}>
              <path
                d={`M ${ix1} ${iy1} L ${ox1} ${oy1} A ${outerR} ${outerR} 0 0 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 0 0 ${ix1} ${iy1}`}
                fill={hasEvents ? alue.color : 'transparent'}
                fillOpacity={hasEvents ? 0.15 + Math.min(count * 0.1, 0.6) : 0}
                stroke={alue.color}
                strokeWidth="0.5"
                strokeOpacity="0.4"
              />
              {hasEvents && (
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                  style={{ fontSize: 7, fontWeight: 700, fill: alue.color, fontFamily: 'system-ui' }}>
                  {count}
                </text>
              )}
            </g>
          )
        })
      })}

      {/* Center label */}
      <circle cx={cx} cy={cy} r={52} fill="white" stroke="#e5e7eb" strokeWidth="1" />
      <text x={cx} y={cy - 8} textAnchor="middle" style={{ fontSize: 10, fontWeight: 800, fill: '#7a0251', fontFamily: 'system-ui' }}>
        {new Date().getFullYear()}
      </text>
      <text x={cx} y={cy + 6} textAnchor="middle" style={{ fontSize: 7, fill: '#9ca3af', fontFamily: 'system-ui' }}>
        Vuosikello
      </text>
    </svg>
  )
}

function MarkkinointiTab() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyMark)
  const [saving, setSaving] = useState(false)
  const [filterMonth, setFilterMonth] = useState(null)
  const [filterAlue, setFilterAlue] = useState(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('marketing_events').select('*').order('month', { ascending: true })
    setEvents(data || [])
    setLoading(false)
  }

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    await supabase.from('marketing_events').insert({
      title: form.title.trim(),
      alue: form.alue,
      month: parseInt(form.month),
      description: form.description.trim() || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm(emptyMark)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko tapahtuma?')) return
    await supabase.from('marketing_events').delete().eq('id', id)
    fetchData()
  }

  function onClickMonth(month, alue) {
    setFilterMonth(month)
    setFilterAlue(alue || null)
  }

  const filtered = events.filter(e => {
    if (filterMonth && e.month !== filterMonth) return false
    if (filterAlue && e.alue !== filterAlue) return false
    return true
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={() => { setForm(emptyMark); setShowModal(true) }}>
          <Plus size={16} /> Uusi tapahtuma
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <Vuosikello events={events} onClickMonth={onClickMonth} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', marginTop: '.75rem' }}>
              {ALUEET.map(a => (
                <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.75rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: a.color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--text2)' }}>{a.label}</span>
                </div>
              ))}
            </div>
          </div>
          {(filterMonth || filterAlue) && (
            <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => { setFilterMonth(null); setFilterAlue(null) }}>
              Näytä kaikki
            </button>
          )}
        </div>

        <div>
          {(filterMonth || filterAlue) && (
            <div style={{ marginBottom: '.75rem', fontSize: '.82rem', color: 'var(--text3)' }}>
              Suodatus: {filterMonth ? MONTH_NAMES[filterMonth - 1] : 'Kaikki kuukaudet'}
              {filterAlue ? ` · ${ALUEET.find(a => a.key === filterAlue)?.label}` : ''}
            </div>
          )}

          {loading ? (
            <p style={{ color: 'var(--text3)' }}>Ladataan...</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ei tapahtumia. Lisää tapahtuma tai klikkaa vuosikelloa suodattaaksesi.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {filtered.map(e => {
                const alue = ALUEET.find(a => a.key === e.alue)
                return (
                  <div key={e.id} className="card" style={{ padding: '.75rem 1rem', display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                    <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: alue?.color || 'var(--violet)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{e.title}</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.15rem' }}>
                        {MONTH_NAMES[(e.month || 1) - 1]} · {alue?.label}
                      </div>
                      {e.description && <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.15rem' }}>{e.description}</div>}
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id)}><Trash2 size={13} /></button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <Modal title="Uusi markkinointitapahtuma" onClose={() => setShowModal(false)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Otsikko</label>
              <input className="input-field" name="title" placeholder="Markkinointitoimenpiteen nimi" value={form.title} onChange={handleChange} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Alue</label>
                <select className="input-field" name="alue" value={form.alue} onChange={handleChange}>
                  {ALUEET.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Kuukausi</label>
                <select className="input-field" name="month" value={form.month} onChange={handleChange}>
                  {MONTH_NAMES.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Kuvaus</label>
              <textarea className="input-field" name="description" rows={3} value={form.description} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'kalenteri', label: 'Kalenteri' },
  { key: 'markkinointi', label: 'Markkinointikalenteri' },
]

export default function CalendarPage() {
  const [tab, setTab] = useState('kalenteri')

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Kalenteri</h1>
          <p className="page-subtitle">Tapahtumat ja markkinointi</p>
        </div>
      </div>

      <div className="sub-tabs" style={{ marginBottom: '1.25rem' }}>
        {TABS.map(t => (
          <button key={t.key} className={`sub-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'kalenteri' ? <KalenteriTab /> : <MarkkinointiTab />}
    </div>
  )
}
