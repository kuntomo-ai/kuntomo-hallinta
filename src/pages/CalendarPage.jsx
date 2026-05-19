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

// ─── Markkinointikalenteri (kanban board) ─────────────────────────────────────

const ALUEET = [
  { key: 'kuntosali', label: 'Kuntosali', color: '#7a0251' },
  { key: 'hieronta', label: 'Hieronta & Fysioterapia', color: '#c2410c' },
  { key: 'valmennus', label: 'Valmennus', color: '#0369a1' },
]

const CATEGORY_TYPES = ['Kampanja', 'Lanseeraus', 'Tarjous', 'Tapahtuma', 'Some-sisältö', 'Muu']
const CATEGORY_COLORS = {
  'Kampanja': '#7a0251', 'Lanseeraus': '#c2410c', 'Tarjous': '#0369a1',
  'Tapahtuma': '#059669', 'Some-sisältö': '#7c3aed', 'Muu': '#6b7280',
}

const emptyMark = {
  title: '', alue: ALUEET[0].key, month: String(new Date().getMonth() + 1),
  description: '', category_type: 'Kampanja', event_date: '',
}

function MarkkinointiTab() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyMark)
  const [saving, setSaving] = useState(false)
  const [filterAlue, setFilterAlue] = useState(null)
  const [filterCategory, setFilterCategory] = useState('')
  const [viewYear, setViewYear] = useState(new Date().getFullYear())

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
      category_type: form.category_type,
      event_date: form.event_date || null,
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

  const filtered = events.filter(e => {
    if (filterAlue && e.alue !== filterAlue) return false
    if (filterCategory && e.category_type !== filterCategory) return false
    return true
  })

  const curMonth = new Date().getMonth()
  const curYear = new Date().getFullYear()

  return (
    <>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setViewYear(y => y - 1)} style={{ padding: '.25rem .4rem' }}><ChevronLeft size={14} /></button>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', minWidth: 52, textAlign: 'center' }}>{viewYear}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setViewYear(y => y + 1)} style={{ padding: '.25rem .4rem' }}><ChevronRight size={14} /></button>
        </div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => { setForm(emptyMark); setShowModal(true) }}>
          <Plus size={16} /> Uusi tapahtuma
        </button>
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {[null, ...ALUEET.map(a => a.key)].map(key => {
          const alue = ALUEET.find(a => a.key === key)
          const label = key === null ? 'Kaikki alueet' : alue?.label
          const color = alue?.color || 'var(--text3)'
          const active = filterAlue === key
          return (
            <button key={key ?? 'all'} onClick={() => setFilterAlue(key)} style={{
              padding: '.3rem .75rem', borderRadius: 99, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${active ? (key === null ? 'var(--border)' : color) : 'var(--border)'}`,
              background: active ? (key === null ? 'var(--bg3)' : `${color}18`) : 'transparent',
              color: active ? (key === null ? 'var(--text)' : color) : 'var(--text3)',
              transition: 'all .15s',
            }}>
              {label}
            </button>
          )
        })}
        <select className="input-field" style={{ width: 'auto', fontSize: '.8rem', padding: '.3rem .6rem', height: 'auto', marginLeft: 'auto' }}
          value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">Kaikki kategoriat</option>
          {CATEGORY_TYPES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Kanban board: 4 cols × 3 rows */}
      {loading ? (
        <p style={{ color: 'var(--text3)' }}>Ladataan...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.65rem' }}>
          {MONTH_NAMES.map((monthName, i) => {
            const monthNum = i + 1
            const monthEvts = filtered.filter(e => e.month === monthNum)
            const isCurrentMonth = (curYear === viewYear && curMonth === i)
            return (
              <div key={i} style={{
                background: isCurrentMonth ? 'var(--violet-subtle)' : 'var(--bg2)',
                borderRadius: 'var(--radius)',
                border: isCurrentMonth ? '1.5px solid var(--violet-border)' : '1px solid var(--border)',
                overflow: 'hidden',
                minHeight: 100,
              }}>
                <div style={{
                  padding: '.55rem .8rem',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: isCurrentMonth ? 'rgba(122,2,81,.07)' : 'transparent',
                }}>
                  <span style={{ fontSize: '.8rem', fontWeight: 700, color: isCurrentMonth ? 'var(--violet)' : 'var(--text2)' }}>
                    {monthName}
                  </span>
                  {monthEvts.length > 0 && (
                    <span style={{
                      fontSize: '.65rem', fontWeight: 700, lineHeight: '1.7',
                      background: isCurrentMonth ? 'var(--violet)' : 'var(--bg3)',
                      color: isCurrentMonth ? '#fff' : 'var(--text3)',
                      borderRadius: 99, padding: '0 .45rem',
                    }}>
                      {monthEvts.length}
                    </span>
                  )}
                </div>
                <div style={{ padding: '.45rem', display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                  {monthEvts.map(e => {
                    const alue = ALUEET.find(a => a.key === e.alue)
                    const catColor = CATEGORY_COLORS[e.category_type] || '#6b7280'
                    return (
                      <div key={e.id} style={{
                        background: 'var(--bg)',
                        borderRadius: 6,
                        padding: '.4rem .55rem',
                        borderLeft: `3px solid ${alue?.color || 'var(--violet)'}`,
                        display: 'flex', gap: '.4rem',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '.78rem', fontWeight: 600, lineHeight: 1.3, marginBottom: '.18rem', wordBreak: 'break-word' }}>
                            {e.title}
                          </div>
                          {e.description && (
                            <div style={{ fontSize: '.68rem', color: 'var(--text3)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {e.description}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '.3rem', marginTop: '.22rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            {e.category_type && (
                              <span style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: catColor, background: `${catColor}18`, borderRadius: 99, padding: '0 .4rem', lineHeight: 1.8 }}>
                                {e.category_type}
                              </span>
                            )}
                            <span style={{ fontSize: '.6rem', color: alue?.color, fontWeight: 600, opacity: .8 }}>{alue?.label}</span>
                          </div>
                        </div>
                        <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text4)', padding: 0, flexShrink: 0, alignSelf: 'flex-start' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Kategoria</label>
                <select className="input-field" name="category_type" value={form.category_type} onChange={handleChange}>
                  {CATEGORY_TYPES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Päivämäärä (valinnainen)</label>
                <input className="input-field" name="event_date" type="date" value={form.event_date} onChange={handleChange} />
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
