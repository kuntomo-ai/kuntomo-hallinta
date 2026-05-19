import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/ui/Modal'

const CATEGORIES = ['tapahtuma', 'kampanja', 'koulutus', 'muu']
const CAT_COLORS = { tapahtuma: 'var(--violet)', kampanja: 'var(--orange)', koulutus: 'var(--blue)', muu: 'var(--green)' }
const CAT_BG = { tapahtuma: 'var(--violet-subtle)', kampanja: 'var(--orange-subtle)', koulutus: 'var(--blue-subtle)', muu: 'var(--green-subtle)' }

const empty = { title: '', category: 'tapahtuma', start_date: '', end_date: '', description: '' }

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1 // Monday=0
}

export default function CalendarPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
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

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

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
    setForm(empty)
    fetchData()
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`

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
  const MONTH_NAMES = ['Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu', 'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu']
  const DAY_NAMES = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su']

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Kalenteri</h1>
          <p className="page-subtitle">Tapahtumat ja kampanjat</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setShowModal(true) }}>
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
    </div>
  )
}
