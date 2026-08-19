import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, Globe, Users, User, Edit2, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'

// ─── Kalenteri tab ────────────────────────────────────────────────────────────

const CATEGORIES = ['tapahtuma', 'kampanja', 'koulutus', 'muu']
const CAT_COLORS = { tapahtuma: 'var(--violet)', kampanja: 'var(--orange)', koulutus: 'var(--blue)', muu: 'var(--green)' }
const CAT_BG = { tapahtuma: 'var(--violet-subtle)', kampanja: 'var(--orange-subtle)', koulutus: 'var(--blue-subtle)', muu: 'var(--green-subtle)' }
const ROLES = ['hallitus', 'terapia_valmennus', 'myynti', 'huolto', 'sport', 'respa', 'admin']
const ROLE_LABELS = {
  hallitus: 'Hallitus', terapia_valmennus: 'Terapia & Valmennus', myynti: 'Myynti',
  huolto: 'Huolto', sport: 'Sport', respa: 'Respa', admin: 'Admin',
}

const emptyEvent = { title: '', category: 'tapahtuma', event_start: '', event_end: '', start_time: '', end_time: '', all_day: true, description: '', recipient_type: 'all', recipient_role: ROLES[0] }

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfMonth(year, month) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

const MONTH_NAMES = ['Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu', 'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu']
const MONTH_SHORT = ['Tam', 'Hel', 'Maa', 'Huh', 'Tou', 'Kes', 'Hei', 'Elo', 'Syy', 'Lok', 'Mar', 'Jou']
const DAY_NAMES = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su']

function KalenteriTab() {
  const { profile, user } = useAuth()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'hallitus'

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyEvent)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  function openModalForDate(dateStr) {
    setEditingEvent(null)
    setForm({ ...emptyEvent, event_start: dateStr, event_end: dateStr })
    setSaveError('')
    setShowModal(true)
  }

  function openEditModal(ev) {
    setEditingEvent(ev)
    setForm({
      title: ev.title || '',
      category: ev.category || 'tapahtuma',
      event_start: ev.event_start?.slice(0, 10) || '',
      event_end: ev.event_end?.slice(0, 10) || ev.event_start?.slice(0, 10) || '',
      start_time: ev.start_time?.slice(0, 5) || '',
      end_time: ev.end_time?.slice(0, 5) || '',
      all_day: !ev.start_time,
      description: ev.description || '',
      recipient_type: ev.recipient_type || 'all',
      recipient_role: ev.recipient_role || ROLES[0],
    })
    setSaveError('')
    setSelectedEvent(null)
    setShowModal(true)
  }

  async function handleDeleteEvent(id) {
    if (!confirm('Poistetaanko tapahtuma?')) return
    setDeleting(true)
    await supabase.from('calendar_events').delete().eq('id', id)
    setDeleting(false)
    setSelectedEvent(null)
    fetchData()
  }

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('calendar_events').select('*').order('event_start', { ascending: true })
    setEvents((data || []).filter(e => shouldShow(e)))
    setLoading(false)
  }

  function shouldShow(e) {
    if (isAdmin) return true
    if (!e.recipient_type || e.recipient_type === 'all') return true
    if (e.recipient_type === 'role' && e.recipient_role === profile?.role) return true
    return false
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
    if (!form.title.trim() || !form.event_start) return
    setSaving(true)
    setSaveError('')
    const payload = {
      title: form.title.trim(),
      category: form.category,
      event_start: form.event_start,
      event_end: form.event_end || form.event_start || null,
      start_time: !form.all_day && form.start_time ? form.start_time : null,
      end_time: !form.all_day && form.end_time ? form.end_time : null,
      description: form.description.trim() || null,
      recipient_type: isAdmin ? form.recipient_type : 'all',
      recipient_role: isAdmin && form.recipient_type === 'role' ? form.recipient_role : null,
    }
    let error
    if (editingEvent) {
      ;({ error } = await supabase.from('calendar_events').update(payload).eq('id', editingEvent.id))
    } else {
      ;({ error } = await supabase.from('calendar_events').insert({ ...payload, created_by: user?.id || null }))
    }
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setShowModal(false)
    setEditingEvent(null)
    setForm(emptyEvent)
    fetchData()
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const eventsByDay = {}
  events.forEach(e => {
    const start = e.event_start?.slice(0, 10)
    const end = (e.event_end || e.event_start)?.slice(0, 10)
    if (!start) return
    let cur = new Date(start)
    const endDate = new Date(end || start)
    while (cur <= endDate) {
      const key = cur.toISOString().slice(0, 10)
      if (!eventsByDay[key]) eventsByDay[key] = []
      eventsByDay[key].push(e)
      cur.setDate(cur.getDate() + 1)
    }
  })

  const todayStr = new Date().toISOString().slice(0, 10)
  const upcomingEvents = events.filter(e => e.event_start?.slice(0, 10) >= todayStr).slice(0, 10)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={() => openModalForDate(today.toISOString().slice(0, 10))}>
          <Plus size={16} /> Uusi tapahtuma
        </button>
      </div>

      <div className="grid-main-aside" style={{ gap: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={prevMonth}><ChevronLeft size={16} /></button>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem' }}>{MONTH_NAMES[month]} {year}</h3>
            <button className="btn btn-ghost btn-sm" onClick={nextMonth}><ChevronRight size={16} /></button>
          </div>

          <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
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
                <div key={day} onClick={() => openModalForDate(dateStr)} className="calendar-cell" style={{ height: 88, borderRadius: 6, padding: '4px 5px', background: isToday ? 'var(--violet-subtle)' : 'var(--bg2)', border: isToday ? '1px solid var(--violet-border)' : '1px solid transparent', cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '.72rem', fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--violet)' : 'var(--text2)', marginBottom: 2, flexShrink: 0 }}>{day}</div>
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} onClick={e => { e.stopPropagation(); setSelectedEvent(ev) }}
                        title={`${ev.title}${ev.recipient_type === 'role' ? ` → ${ev.recipient_role}` : ''}`}
                        style={{ fontSize: '.62rem', fontWeight: 600, background: CAT_BG[ev.category] || 'var(--bg3)', color: CAT_COLORS[ev.category] || 'var(--text3)', borderRadius: 3, padding: '1px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0 }}>
                        {ev.start_time && <span style={{ opacity: .75, fontWeight: 500 }}>{ev.start_time.slice(0, 5)} </span>}
                        {ev.recipient_type === 'role' && <span style={{ opacity: .6 }}>👥 </span>}
                        {ev.title}
                      </div>
                    ))}
                  </div>
                  {dayEvents.length > 3 && <div style={{ fontSize: '.58rem', color: 'var(--text4)', flexShrink: 0 }}>+{dayEvents.length - 3}</div>}
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
                      {new Date(e.event_start).toLocaleDateString('fi-FI')}
                      {e.start_time && ` klo ${e.start_time.slice(0, 5)}`}
                      {e.event_end && e.event_end?.slice(0, 10) !== e.event_start?.slice(0, 10) && ` – ${new Date(e.event_end).toLocaleDateString('fi-FI')}`}
                      {e.end_time && ` – ${e.end_time.slice(0, 5)}`}
                    </div>
                    <span style={{ fontSize: '.65rem', color: CAT_COLORS[e.category] || 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{e.category}</span>
                  </div>
                  <button onClick={() => handleDeleteEvent(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text4)', padding: '.1rem', flexShrink: 0 }} title="Poista">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedEvent && (
        <Modal title={selectedEvent.title} onClose={() => setSelectedEvent(null)} footer={
          <>
            {isAdmin && (
              <button className="btn btn-danger" onClick={() => handleDeleteEvent(selectedEvent.id)} disabled={deleting}>
                {deleting ? 'Poistetaan...' : 'Poista'}
              </button>
            )}
            {isAdmin && (
              <button className="btn btn-secondary" onClick={() => openEditModal(selectedEvent)}>
                <Edit2 size={14} /> Muokkaa
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setSelectedEvent(null)}>Sulje</button>
          </>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
            <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
              <span style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text2)' }}>
                {new Date(selectedEvent.event_start).toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {selectedEvent.start_time && ` klo ${selectedEvent.start_time.slice(0, 5)}`}
                {selectedEvent.end_time && ` – ${selectedEvent.end_time.slice(0, 5)}`}
              </span>
            </div>
            {selectedEvent.event_end && selectedEvent.event_end?.slice(0, 10) !== selectedEvent.event_start?.slice(0, 10) && (
              <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>
                – {new Date(selectedEvent.event_end).toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            )}
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.72rem', fontWeight: 700, color: CAT_COLORS[selectedEvent.category] || 'var(--text3)', background: CAT_BG[selectedEvent.category] || 'var(--bg2)', borderRadius: 99, padding: '2px 10px' }}>
                {selectedEvent.category}
              </span>
              {selectedEvent.recipient_type === 'role' && (
                <span style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 99, padding: '2px 10px' }}>
                  👥 {ROLE_LABELS[selectedEvent.recipient_role] || selectedEvent.recipient_role}
                </span>
              )}
            </div>
            {selectedEvent.description && (
              <p style={{ fontSize: '.85rem', color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>{selectedEvent.description}</p>
            )}
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal title={editingEvent ? 'Muokkaa tapahtumaa' : 'Uusi tapahtuma'} onClose={() => { setShowModal(false); setEditingEvent(null) }} footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setShowModal(false); setEditingEvent(null) }}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Tallennetaan...' : (editingEvent ? 'Tallenna muutokset' : 'Tallenna')}
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
            <div className="input-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', marginBottom: '.5rem' }}>
                <input type="checkbox" checked={form.all_day} onChange={e => setForm(f => ({ ...f, all_day: e.target.checked, start_time: '', end_time: '' }))} />
                <span className="input-label" style={{ margin: 0 }}>Koko päivän tapahtuma</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: form.all_day ? '1fr 1fr' : '1fr auto 1fr', gap: '.5rem', alignItems: 'end' }}>
                <div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginBottom: '.2rem' }}>Alkaa</div>
                  <input className="input-field" name="event_start" type="date" value={form.event_start} onChange={handleChange} />
                  {!form.all_day && <input className="input-field" name="start_time" type="time" value={form.start_time} onChange={handleChange} style={{ marginTop: '.35rem' }} />}
                </div>
                {!form.all_day && <span style={{ color: 'var(--text3)', paddingBottom: '.4rem', textAlign: 'center' }}>–</span>}
                <div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginBottom: '.2rem' }}>Loppuu</div>
                  <input className="input-field" name="event_end" type="date" value={form.event_end} onChange={handleChange} />
                  {!form.all_day && <input className="input-field" name="end_time" type="time" value={form.end_time} onChange={handleChange} style={{ marginTop: '.35rem' }} />}
                </div>
              </div>
            </div>
            {isAdmin && (
              <div className="input-group">
                <label className="input-label">Näkyvyys</label>
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                  {[['all', <Globe size={13} />, 'Kaikille'], ['role', <Users size={13} />, 'Roolille']].map(([v, icon, label]) => (
                    <button key={v} type="button"
                      onClick={() => setForm(f => ({ ...f, recipient_type: v }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '.35rem',
                        padding: '.3rem .65rem', borderRadius: 20, fontSize: '.78rem', fontWeight: 600,
                        border: `1.5px solid ${form.recipient_type === v ? 'var(--violet)' : 'var(--border)'}`,
                        background: form.recipient_type === v ? 'var(--violet-subtle)' : 'transparent',
                        color: form.recipient_type === v ? 'var(--violet)' : 'var(--text3)',
                        cursor: 'pointer',
                      }}>
                      {icon} {label}
                    </button>
                  ))}
                </div>
                {form.recipient_type === 'role' && (
                  <select className="input-field" style={{ marginTop: '.5rem', width: 'auto' }}
                    value={form.recipient_role}
                    onChange={e => setForm(f => ({ ...f, recipient_role: e.target.value }))}>
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                  </select>
                )}
              </div>
            )}
            <div className="input-group">
              <label className="input-label">Kuvaus</label>
              <textarea className="input-field" name="description" rows={3} value={form.description} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
            {saveError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '.6rem .9rem', fontSize: '.82rem', color: 'var(--red)' }}>
                ⚠️ {saveError}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── Markkinointikalenteri data ────────────────────────────────────────────────

const ALUEET = [
  { key: 'kuntosali', label: 'Kuntosali', color: '#7a0251' },
  { key: 'hieronta', label: 'Hieronta & Fysioterapia', color: '#c2410c' },
  { key: 'valmennus', label: 'Valmennus', color: '#0369a1' },
]

const SEASON_THEMES = {
  talvi: {
    label: 'Talvi', months: 'Joulu–Helmikuu', emoji: '❄️',
    color: '#bfdbfe', dark: '#1e40af',
    kuntosali: { teema: 'Uudenvuosilupaukset & kehonmuokkaus', viestit: ['Tammikuun aloitustarjous', 'Ystävänpäivä – treenaa kaverin kanssa', 'Talvifysiikka – vahvuus & lihastyö'] },
    hieronta: { teema: 'Talvikehon huolto & palautuminen', viestit: ['Joulun jälkeinen kehon reset', 'Talviurheiluvammat & ennaltaehkäisy', 'Kuumakivihieronta kylmille lihaksille'] },
    valmennus: { teema: 'Tavoiteasettelu & uusi ohjelma', viestit: ['Uudenvuoden tavoitepalaveri', 'Talvifysiikka – perustaa rakentamassa', 'PT-kampanja tammikuu'] },
  },
  kevät: {
    label: 'Kevät', months: 'Maalis–Toukokuu', emoji: '🌱',
    color: '#bbf7d0', dark: '#15803d',
    kuntosali: { teema: 'Kesäkuntoon – haasteet & ohjelmat', viestit: ['12 viikon kesäkunto-ohjelma', 'Pääsiäishaaste', 'Äitienpäivä – lahjakorttikampanja'] },
    hieronta: { teema: 'Kevätaktivointi & juoksukauden aloitus', viestit: ['Ennaltaehkäisevä hieronta ennen ulkokautta', 'Selkäkipu & etätyöpaketti', 'Juoksuvammojen hoito – alaraajahuolto'] },
    valmennus: { teema: 'Juoksukausi & kesäkunto-ohjelma', viestit: ['Juoksuvalmennus – kauden aloitus', '12 viikon kesäkunto alkaa maaliskuussa', 'Sprint to Summer – viimeinen viikko'] },
  },
  kesä: {
    label: 'Kesä', months: 'Kesä–Elokuu', emoji: '☀️',
    color: '#fef08a', dark: '#92400e',
    kuntosali: { teema: 'Kesäkunto & lomakausi', viestit: ['Kesäjäsenyys – 3 kk edullisesti', 'Heinäkuu: kotitreeniohjelma kaikille', 'Syysstartti – elokuun uudet vuorot'] },
    hieronta: { teema: 'Lomahuolto & palautuminen', viestit: ['Lomaennenhoito – lähde parhaimmassa kunnossa', 'Kesäurheilun palautumishieronta', 'Syyslataushoito ennen kiirettä'] },
    valmennus: { teema: 'Lomaohjelma & midyear check-in', viestit: ['Lomaharjoitusohjelma (matkalle sopiva)', 'Heinäkuun haaste – midyear check-in', 'Syyskauden ohjelma – elokuu'] },
  },
  syksy: {
    label: 'Syksy', months: 'Syys–Marraskuu', emoji: '🍂',
    color: '#fed7aa', dark: '#c2410c',
    kuntosali: { teema: 'Syysstartti & Black Friday', viestit: ['Syysstartti-kampanja – uudet jäsenyydet', 'Halloween-treenihaaste lokakuu', 'Black Friday – paras vuositarjous'] },
    hieronta: { teema: 'Stressinhallinta & talvivalmistautuminen', viestit: ['Syysstressihoito – kortisoli alas', 'Syysväsymys & immuunijärjestelmä', 'Laskettelukauden valmistautumishoito'] },
    valmennus: { teema: 'Talvikauden tavoitteet & kuntotesti', viestit: ['Q4-tavoitesuunnitelma syyskuu', 'Kuntotesti & väliarviointi lokakuu', 'Pre-Christmas – pysy kurssilla marraskuu'] },
  },
}

const NEWSLETTERS = {
  kuntosali: [
    {
      otsikko: 'Uusi vuosi, uusi kunto! 💪',
      ingressi: 'Tammikuu on vuoden tärkein kuukausi kunnon kannalta – aloita vahvasti ja tee siitä tapa.',
      tarjous: 'Uusille jäsenille: 1. kuukausi -20% + ilmainen perehdytys',
      cta: 'Liity nyt →',
      sisalto: `Hyvä Kuntomon jäsen,

uusi vuosi tuo mukanaan uuden mahdollisuuden – ja tiedät sen itsekin. Tammikuu on se hetki, kun muutos on kaikista helpoimmillaan aloittaa: motivaatio on korkealla, ympärillä on muita samassa tilanteessa ja arki tarjoaa rakenteet uusille tavoille.

Kuntomolla olemme valmistautuneet tähän hetkeen. Uudistimme ryhmäliikuntatunteja, laajensimme aukioloaikoja ja koulutimme henkilökuntaa. Uusille jäsenille tarjoamme perehdytyksen, kehonkoostumusmittauksen ja henkilökohtaisen aloitusohjelman – kaikki sisältyvät jäsenyyteen.

Tärkeintä ei ole millainen kunto sinulla on juuri nyt. Tärkeintä on, että aloitat. Meillä on sopiva tapa jokaiselle – yksin treenaavalle, ryhmässä viihtyvällä ja henkilökohtaista ohjausta haluavalle.

Ensimmäinen kuukausi on nyt -20% uusille jäsenille. Tule tutustumaan ilman paineita – varaa aika perehdytykseen tai käy vain katsomassa. Odotamme sinua.`,
    },
    {
      otsikko: 'Ystävänpäivä: Treenaa yhdessä ❤️',
      ingressi: 'Tuo kaveri mukaan – veloituksetta. Yhdessä on aina parempi.',
      tarjous: 'Kaveri mukaan helmikuussa ilmaiseksi – koko kuun ajan',
      cta: 'Kutsu kaveri →',
      sisalto: `Hyvä Kuntomon jäsen,

ystävänpäivä on 14. helmikuuta – ja tänä vuonna haastamme sinut juhlistamaan sitä hiukan epätavallisella tavalla: tuo ystäväsi mukaan kuntosalille.

Treenaaminen yhdessä on yksi tehokkaimmista tavoista pysyä motivoituneena. Kaverin kanssa menee harva päivä hukkaan, harjoitukset ovat hauskempia ja kilpailuvietti pitää vauhdin yllä. Tutkimukset osoittavat toistuvasti: yhdessä treenaavat ihmiset saavuttavat tavoitteensa useammin kuin yksin harjoittelevat.

Helmikuun ajan kaikki Kuntomon jäsenet saavat tuoda ystävänsä mukaan veloituksetta. Ei kokeiluaikoja, ei rekisteröitymistä, ei rajoituksia – tule milloin haluat, ota kuka tahansa kaveri mukaasi.

Sopikaa aika yhdessä ja tulkaa. Ryhmäliikuntatunnit, kuntosali, uima-allas – kaikki on avoinna. Ystävänpäivä on täydellinen syy aloittaa se yhteinen treenirutiini, josta olette puhuneet jo pidemmän aikaa.`,
    },
    {
      otsikko: 'Kesäkuntoon – 12 viikkoa! 🌱',
      ingressi: 'Kesä on tasan 12 viikon päässä. Se on juuri oikea määrä aikaa merkittävään muutokseen.',
      tarjous: 'Ilmainen PT-tapaaminen + henkilökohtainen harjoitusohjelma',
      cta: 'Aloita ohjelma →',
      sisalto: `Hyvä Kuntomon jäsen,

maaliskuu. Ulkona on vielä kylmä, mutta kesä on nyt tasan 12 viikkoa päässä. Se ei ole paljon aikaa – mutta se on tarkalleen oikea määrä aikaa merkittävään muutokseen, jos aloitat heti.

12 viikkoa on vakiintunut standardi kehon muuttamiseen syystä: se on tarpeeksi pitkä aika näkyviin tuloksiin, mutta tarpeeksi lyhyt pysymään motivoituneena koko matkan. Kuntomon personal trainerit suunnittelevat sinulle ohjelman, joka tähtää juuri niihin asioihin, joita haluat muuttaa ennen kesää.

Ohjelma sisältää viikoittaisen etenemissuunnitelman, kehon seurantamittaukset ja tuen koko matkan ajan. Et jää yksin – valmentaja on käytettävissäsi kysymyksiä ja säätöjä varten läpi koko jakson.

Ilmainen PT-tapaaminen antaa sinulle selkeän suunnitelman ensimmäisestä kerrasta lähtien. Varaa aikasi nyt – paikkoja on rajallinen määrä ja maaliskuu on suosituin kuukausi aloittaa.`,
    },
    {
      otsikko: 'Pääsiäishaaste – voita palkinto! 🐣',
      ingressi: 'Haasta itsesi pääsiäislomalla – päivittäinen tehtävä, pisteet ja palkinnot.',
      tarjous: 'Haaste 10.–21.4. – osallistuminen ilmainen kaikille jäsenille',
      cta: 'Ilmoittaudu →',
      sisalto: `Hyvä Kuntomon jäsen,

pääsiäisloma on usein se hetki, kun treenirytmi katkeaa. Lomalla ollaan, liikutaan vähemmän, syödään enemmän – ja palataan arkeen hiukan huonommassa kunnossa kuin lähdettiin.

Tänä vuonna tehdään toisin. Kuntomon Pääsiäishaaste 10.–21.4. on kymmenpäiväinen treenihaaste, johon kaikki jäsenet voivat osallistua. Päivittäinen tehtävä on lyhyt ja selkeä – sopii lomapäivälle täydellisesti eikä vie koko iltapäivää.

Haaste ei vaadi erityistä kuntotasoa. Tehtävät on suunniteltu niin, että ne voi tehdä kotona, ulkona tai salilla – missä tahansa, missä viietät pääsiäisen. Pisteitä kertyy jokaisesta suoritetusta tehtävästä, ja parhaat suorittajat palkitaan.

Seuraa pisteitäsi ja kilpaile muiden jäsenten kanssa. Haaste on ilmainen kaikille Kuntomon jäsenille. Ilmoittaudu mukaan salin infosta tai verkkosivuilta ennen 10.4.`,
    },
    {
      otsikko: 'Äitienpäivä: Lahjoita hyvinvointi 🌸',
      ingressi: 'Paras lahja äidille on sellainen, joka kestää kukkia ja suklaata pidempään.',
      tarjous: 'Lahjakortit alk. 30 € | Voimassa 6 kuukautta',
      cta: 'Hanki lahjakortti →',
      sisalto: `Hyvä Kuntomon jäsen,

toukokuun toisena sunnuntaina on äitienpäivä – ja paras lahja on sellainen, joka kestää hetkeä pidempään kuin kukat tai suklaa.

Kuntomon lahjakortit ovat täydellinen äitienpäivälahja. Äiti itse valitsee, haluaako hän kokeilla kuntosalia, ryhmäliikuntaa vai henkilökohtaista valmennusta. Lahjakortti on voimassa 6 kuukautta, joten käyttöaikaa on reilusti eikä se jää käyttämättä.

Saatavilla on erikokoisia paketteja: yksittäinen tutustumiskäynti, kuukauden jäsenyys tai personal training -kerta. Lahjakortit voi ostaa salin vastaanotosta tai tilata verkkokaupastamme. Toimitamme ne kauniisti pakattuna tai sähköisenä – kumpi sopii paremmin.

Äitienpäivälahjakortit kannattaa hankkia ajoissa. Hinta alkaa 30 eurosta ja jokainen paketti on räätälöitävissä äidin toiveiden mukaan. Tule valitsemaan tai tilaa verkossa.`,
    },
    {
      otsikko: 'Kesä täydessä vauhdissa! ☀️',
      ingressi: 'Kesäjäsenyys nyt – kolme kuukautta edullisempaan hintaan.',
      tarjous: 'Kesäjäsenyys 3 kk (kesä–elokuu) | Ei sitoutumista',
      cta: 'Hanki kesäjäsenyys →',
      sisalto: `Hyvä Kuntomon jäsen,

kesäkuu on Kuntomolla elävää aikaa. Ryhmäliikunta siirtyy osittain ulos, uudet tunnit käynnistyvät ja salit ovat auki koko kesäloman ajan. Juuri nyt on paras hetki kokeilla tai liittyä, jos jäsenyys on ollut mielessä.

Kesäjäsenyys kattaa kesäkuun, heinäkuun ja elokuun – kolme kuukautta – edullisemmalla yhteishinnalla. Saat käyttöön kaikki salin tilat, ryhmäliikuntavuorot ja uima-altaan ilman lisämaksuja tai piilokustannuksia.

Ei sitoutumista vuodeksi. Kesäjäsenyys päättyy elokuun lopussa, jonka jälkeen voit joko jatkaa normaalilla kuukausijäsenyydellä tai pitää tauon. Meillä ei ole automaattista jatkumista tai irtisanomisaikoja – sinä päätät.

Tule tutustumaan tai liity suoraan verkossa. Kesäjäsenyys alkaa kun sinulle sopii – myös kesäkuun puolessa välissä tai jopa heinäkuussa.`,
    },
    {
      otsikko: 'Lomallakin voi treenata! 🏖️',
      ingressi: 'Kotitreeniohjelma ilmaiseksi kaikille jäsenille – toimii rannalla, mökillä ja hotellihuoneessa.',
      tarjous: 'Ilmainen kotitreeniohjelma kaikille jäsenille | Heinäkuu',
      cta: 'Pyydä ohjelma →',
      sisalto: `Hyvä Kuntomon jäsen,

heinäkuu on lomien aikaa – ja se on täysin ansaittua. Mutta lomalla liikkuminen on yllättävän helppoa, kun on selkeä suunnitelma.

Kuntomon jäsenille heinäkuussa täysin ilmainen kotitreeniohjelma, joka on suunniteltu lomaolosuhteisiin. Ei tarvita kuntosalia, ei erityisvälineitä, ei tiukkaa aikataulua. Ohjelma toimii hotellihuoneessa, puistossa, rannalla tai kesämökin pihalla.

Ohjelma sisältää neljä viikottaista harjoitusta, jotka kestävät 20–35 minuuttia. Jokaiseen treeniviikkoon kuuluu ylä- ja alavartalotreeni, core-harjoitus ja palauttava venyttely. Tasoja on kolme – valitset oman kuntotasosi mukaan.

Pyydä ohjelmaa salin infosta tai vastaa tähän viestiin sähköpostiosoitteesi kanssa – lähetämme ohjelman heti. Mukavaa lomaa, ja muistathan: pienikin liike lomalla tekee paluun arkeen helpommaksi.`,
    },
    {
      otsikko: 'Syysstartti – takaisin täysillä! 🍂',
      ingressi: 'Loma ohi, uusi rytmi alkaa. Liittymismaksu nolla euroa koko elokuun.',
      tarjous: 'Uusille jäsenille: liittymismaksu 0 € | Elokuussa',
      cta: 'Liity elokuussa →',
      sisalto: `Hyvä Kuntomon jäsen,

loma alkaa olla takana – ja se on yleensä juuri se hetki, kun uusi innostus herää. Syyskuun alku tuntuu melkein kuin uudelta tammikuulta: on halua muuttaa tapoja, lisätä liikuntaa ja saada arkeen rakennetta.

Kuntomolla elokuu on syysstartin kuukausi. Uudet ryhmäliikuntatunnit käynnistyvät, syyskauden aikataulut astuvat voimaan ja salit avataan taas täydelle teholle lomakausien jälkeen. Nyt on oikea hetki liittyä tai palata, jos kesä meni muualla.

Uusille jäsenille elokuussa: liittymismaksu nolla euroa. Maksat vain kuukausimaksun – aloittaminen on tehty mahdollisimman helpoksi. Lisäksi ilmainen perehdytys ja aloitusohjelma kaikille uusille jäsenille.

Paikkoja on rajoitetusti ja elokuu täyttyy nopeasti. Ota yhteyttä tai käy salilla – aloitetaan syyskausi yhdessä.`,
    },
    {
      otsikko: 'Syysstartti-kampanja! 🎯',
      ingressi: 'Syyskuu on toinen tammikuu – ja meillä on tarjous, joka sopii juuri tähän hetkeen.',
      tarjous: '2 kuukautta yhden hinnalla | Uusille ja palaavilla jäsenille',
      cta: 'Hyödynnä tarjous →',
      sisalto: `Hyvä Kuntomon jäsen,

syyskuu on motivaation huippu. Loma on ohi, arki on palannut – ja se hetki, jolloin uudet tottumukset tuntuvat juuri sopivan yksinkertaisilta. Tutkimusten mukaan syyskuu on toiseksi paras kuukausi uusien liikuntarutiinien aloittamiseen heti tammikuun jälkeen.

Kuntomo hyödyntää tämän hetken. Syyskuussa uusille ja palaavilla jäsenille: kaksi kuukautta yhden kuukauden hinnalla. Et maksa ylimääräistä – saat toisen kuukauden veloituksetta, kun liityt tai palaat nyt.

Tarjous on voimassa koko syyskuun. Ei piiloehtoja: tarjous koskee kaikkia kuukausijäsenyyden tyyppejä ja sisältää täydet oikeudet kaikkiin tiloihin ja palveluihin. Kaksi kuukautta tarkoittaa syyskuun ja lokakuun – juuri sen ajan, jonka uuden tavan muodostuminen vaatii.

Syyskuu menee nopeasti. Liity nyt verkossa tai käy salilla – otetaan uusi kausi haltuun vahvasti.`,
    },
    {
      otsikko: 'Halloween-treenihaaste! 🎃',
      ingressi: 'Lokakuu on Kuntomon haastekuukausi – päivittäiset tehtävät, pisteet ja palkinnot.',
      tarjous: 'Haaste 1.–31.10. – kaikille jäsenille ilmainen',
      cta: 'Osallistu →',
      sisalto: `Hyvä Kuntomon jäsen,

lokakuu on pimeyden, stressin ja – jos antaa periksi – sohvalla istumisen kuukausi. Tai sitten se on Kuntomon Halloween-haasteen kuukausi.

Haaste käynnistyy 1. lokakuuta ja kestää koko kuun. Päivittäinen liikuntatehtävä, viikottaiset ryhmäteemat ja pistejärjestelmä, joka pitää motivaation yllä koko matkan. Selviytyjiä palkitaan – mutta jo osallistuminen on voitto pimeintä kautta vastaan.

Haaste on suunniteltu kaikille kuntotasoille. Aloittelija, kestävyysliikkuja tai voimaharjoittelija – jokaiselle on sopiva versio tehtävistä. Haaste skaalautuu sinulle sopivaksi, ei toisinpäin. Tehtävät voi tehdä salilla, kotona tai ulkona.

Osallistuminen on ilmaista kaikille Kuntomon jäsenille. Ilmoittaudu salin vastaanotosta tai verkkosivuilla viimeistään 1.10. Kutsu myös ystäväsi mukaan – yhteinen haaste on paljon hauskempi kuin yksin suoritettu.`,
    },
    {
      otsikko: 'Black Friday – paras tarjous vuodessa! 🖤',
      ingressi: 'Kerran vuodessa. 30% alennus vuosijäsenyydestä. Vain perjantaina 25.11.',
      tarjous: 'Vuosijäsenyys -30% | VAIN 25.11.',
      cta: 'Käytä tarjous →',
      sisalto: `Hyvä Kuntomon jäsen,

kerran vuodessa meillä on se tarjous, josta kannattaa ottaa kiinni. Tänä vuonna mustana perjantaina 25.11. tarjoamme vuosijäsenyyden 30% alennuksella – tämä on alhaisin hinta, johon Kuntomo on koskaan laskenut vuosijäsenyyden.

Miksi vuosijäsenyys kannattaa? Se on kustannustehokkain tapa pitää itsensä kunnossa läpi vuoden. Tarjoushinnalla säästät yli 80 euroa kuukausijäsenyyteen verrattuna. Ja sitoutuminen vuodeksi on tutkitusti tehokkain tapa pysyä liikkeessä – kun jäsenyys on maksettu, kynnys tulla salille on matalampi.

Tarjous on voimassa vain 25.11. – yhden päivän ajan. Se ei toistu ennen ensi vuoden Black Fridayta. Tarjouspaikkoja ei ole erikseen rajattu, mutta ruuhka syntyy aina ja verkkokauppa voi olla hetkittäin hidas.

Merkitse päivämäärä kalenteriin jo nyt. Voit ostaa jäsenyyden verkossa tai salilla. Jäsenyys alkaa milloin itse haluat – voit ostaa nyt ja aloittaa tammikuussa.`,
    },
    {
      otsikko: 'Joululahjakortit & loppukiri! 🎄',
      ingressi: 'Paras joululahja on hyvinvointi. Ja itselle: viimeistele vuosi vahvasti.',
      tarjous: 'Lahjakortit alk. 30 € | Joululoppukiri käynnissä koko joulukuun',
      cta: 'Hanki lahjakortti →',
      sisalto: `Hyvä Kuntomon jäsen,

joulukuu on kahta asiaa samanaikaisesti: kiireisintä kuukautta ja parasta hetkeä hidastua. Kuntomolla haluamme auttaa sinut molemmissa.

Joulukuun Treenihaaste pitää sinut liikkeessä joulun kiireiden keskelläkin – lyhyet, tehokkaat harjoitukset jotka mahtuvat kiireisimpäänkin päivään. Tavoite on yksinkertainen: treeni ei taistele joulun kanssa, se sopeutuu siihen.

Lahjakortit ovat auki koko joulukuun. Kuntosali, ryhmäliikunta, personal training – kaikkiin palveluihin saa lahjakortin. Hinta alkaa 30 eurosta. Lahjakortti on aina oikea koko ja paras vaihtoehto sille, jolle ei tiedä mitä ostaa. Sähköinen lahjakortti toimitetaan heti – sopii myös viime hetken lahjalle.

Kaikille nykyisille jäsenille: kiitos kuluvasta vuodesta. Teette Kuntomosta sen mitä se on. Hyvää joulua ja voimaa ensi vuodelle!`,
    },
  ],
  hieronta: [
    {
      otsikko: 'Kehon reset uudelle vuodelle! 🌟',
      ingressi: 'Joulu jätti jälkensä – tammikuu on täydellinen aika antaa keholle kaipaamansa huolto.',
      tarjous: 'Tammikuun reset-paketti: 2 hierontaa puolitoista hinnalla',
      cta: 'Varaa hoito →',
      sisalto: `Hyvä Kuntomon asiakas,

joulu on juhlinnan ja kiireiden aikaa – keho kerää sen aikana jännityksiä, rasitusta ja väsymystä tavalla, jota ei aina edes huomaa. Epäsäännölliset unet, lomaruoka, pitkät istumispäivät ja sosiaalinen kiire jättävät jälkensä.

Tammikuu on täydellinen aika antaa keholle se huolto, jota se on ansainnut. Hieronta ja fysioterapia yhdistettynä tekevät merkittävän eron: lihasjännitykset laukeaa, verenkierto paranee ja keho palautuu rasituksesta tehokkaammin. Säännöllinen hoito tammikuussa rakentaa pohjan koko loppuvuodelle.

Tarjoamme tammikuun erityispakettia: kaksi hierontakertaa puolitoista hinnalla. Ensimmäinen kerta puhdistaa joulun jälkeisen jännityksen, toinen vakiinnuttaa hyvän olon pysyvämmäksi.

Ei tarvitse oireita – ennaltaehkäisevä hoito on kaikkein kustannustehokkain tapa pitää keho toimintakuntoisena. Varaa aika verkosta tai soita suoraan. Tammikuun ajat täyttyvät nopeasti.`,
    },
    {
      otsikko: 'Talvikehon huolto ❄️',
      ingressi: 'Kylmät lihakset, jäykkyys, niskakipu – talvi on kehon kovimpia kokeita. Kuumakivihieronta auttaa.',
      tarjous: 'Helmikuun talvipaketti: 75 min kuumakivihieronta',
      cta: 'Varaa →',
      sisalto: `Hyvä Kuntomon asiakas,

helmikuussa Suomessa on kylmintä. Kehon lihakset reagoivat kylmyyteen supistumalla, mikä johtaa jäykkyyteen, kivuihin ja heikentyneeseen liikkuvuuteen – erityisesti niska-hartiaseudulla, selässä ja alaraajoissa. Moni tottuu tähän olotilaan ilman, että huomaa kuinka paljon paremmin keho voisi toimia.

Kuumakivihieronta on talvinen erityishoidomme. Kuumat basalttikivet sulautuvat lihaksiin syvemmältä kuin kädet yksin, lämmittäen ja rentouttaen yhtä aikaa. Kivet pitävät lämmön pidempään – ja lihakset reagoivat syvempään rentoutumiseen kuin tavallisessa hieronnassa.

Talvipaketti sisältää 75 minuutin kuumakivihieronnan, jossa käydään läpi selkä, niska-hartiaseutu ja jalat. Hoito on sopiva sekä ensimmäiselle hierontakäynnille että säännölliselle asiakkaalle.

Helmikuussa vapaat ajat menevät nopeasti – varaa ajoissa. Nettivaraus käy ympäri vuorokauden tai soita suoraan meille.`,
    },
    {
      otsikko: 'Kevätaktivointi – ole valmis! 🌿',
      ingressi: 'Ulkoliikunta alkaa – mutta talvijäykät lihakset ovat loukkaantumisriski. Ennaltaehkäise ajoissa.',
      tarjous: 'Kevätaktivointikäynti: Lihashuolto + liikkuvuusohjelma',
      cta: 'Varaa kevätaktivointikäynti →',
      sisalto: `Hyvä Kuntomon asiakas,

maaliskuu tuo valoa, pidempiä päiviä ja halun liikkua enemmän. Ulkolenkki, pyöräily, pallopelit – keho aktivoituu talven jälkeen nopeasti. Mutta talven aikana jäykistyneet lihakset ja nivelet ovat loukkaantumisriski, jos aktivointi tapahtuu liian nopeasti ja ilman valmistelua.

Ennaltaehkäisevä hieronta ennen kauden aloitusta on viisain sijoitus. Lihakset laukaistaan, nivelet tarkistetaan liikkuvuuden suhteen ja keho valmistellaan optimaaliselle tasolle – ennen kuin urheilukausi alkaa ja kuormitus kasvaa merkittävästi.

Kevätaktivointikäynti sisältää koko kehon lihashuollon erityisellä painotuksella alaraajoihin, lantioon ja selkään. Mukaan saat kotiin liikkuvuusharjoitteet, joita voit tehdä itse ennen treenejä.

Varaa kevätaktivointikäynti maaliskuun aikana. Ennaltaehkäisy on aina halvempaa kuin loukkaantumisen hoitaminen – sekä rahallisesti että ajallisesti menetettyinä treenipäivinä.`,
    },
    {
      otsikko: 'Selkäkipu & etätyö 💻',
      ingressi: 'Etätyön yleisin haitta on niska-hartiakipu. Hoidetaan se kunnolla – hieronta + ergonomiaohjaus.',
      tarjous: 'Etätyöpaketti: 60 min hieronta + ergonomiaohjaus',
      cta: 'Varaa etätyöpaketti →',
      sisalto: `Hyvä Kuntomon asiakas,

etätyö on muuttanut suomalaisten työskentelyasentoja merkittävästi. Kotitoimistojen ergonomia on useimmiten huonompi kuin toimistolla: näyttö liian alhaalla, tuoli väärän korkuinen, hiiri liian kaukana. Pitkät istumispäivät samassa asennossa johtavat niska-hartiakipuihin, selkäongelmiin ja päänsärkyyn.

Fysioterapia ja hieronta yhdistettynä ergonomiaohjaukseen on todettu tehokkaimmaksi tavaksi hoitaa etätyön aiheuttamia vaivoja. Hieronta laukaisee olemassa olevat jännitykset – ergonomiaohjaus ehkäisee niiden syntymisen uudelleen. Pelkkä hieronta ilman tilanteen korjaamista on kuin tyhjennettyä ämpäriä: se täyttyy taas nopeasti.

Etätyöpakettimme sisältää: 60 minuutin niska-hartiahieronnan, ergonomia-arvion ja venyttelyohjeen kotiin.

Paketti sopii niin niille, joilla on jo oireita, kuin niille jotka haluavat ehkäistä ne ennen kuin ne alkavat. Varaa aika – mainitse varauksessa, että haluat etätyöpaketin.`,
    },
    {
      otsikko: 'Juoksukausi alkaa! 🏃',
      ingressi: 'Toukokuu on juoksijoiden kuukausi – alaraajahuolto kauden alussa estää tyypillisimmät vammat.',
      tarjous: 'Juoksijapaketti: 75 min alaraajahuolto + lihastasapainoarvio',
      cta: 'Varaa juoksijapaketti →',
      sisalto: `Hyvä Kuntomon asiakas,

toukokuu on juoksijoiden kuukausi. Lenkkipolut heräävät eloon, harjoitusmäärät kasvavat ja juoksutapahtumat lähestyvät. Mutta juoksukaudella loukkaantumisriski on suurimmillaan – erityisesti kauden alussa, kun elimistö ei ole vielä tottunut kasvaneeseen kuormitukseen.

Juoksijapakettimme on suunniteltu ehkäisemään yleisimpiä juoksuvammoja: polven IT-jänteen ärsytystä, akillesjänteen ongelmia, plantaarifaskiittia ja sääriluun rasitusoireistoa. Nämä kaikki syntyvät usein kauden alussa, kun innostus vie pidemmälle kuin kehon valmius.

Paketti sisältää: 75 minuutin alaraajahieronnan, lihastasapainoarvion ja harjoittelua tukevan venyttelyohjelman.

Varaa juoksijapaketti nyt – ennen kuin ensimmäiset oireet alkavat. Juoksijat, jotka huoltavat säännöllisesti, juoksevat pidempään, enemmän ja nauttivat siitä enemmän kuin ne, jotka odottavat vamman syntymistä.`,
    },
    {
      otsikko: 'Ennen lomaa – huolto kuntoon! 🌅',
      ingressi: 'Lähde lomalle parhaimmassa mahdollisessa kunnossa. Kehon reset ennen kesälomaa.',
      tarjous: 'Lomaennenhoito: Kokonaisvaltainen hieronta -10% | Varaa ennen juhannusta',
      cta: 'Varaa ennen lomaa →',
      sisalto: `Hyvä Kuntomon asiakas,

loma alkaa – ja sinulla on mahdollisuus valita: lähtetkö uupuneena ja jännittyneenä vai parhaassa mahdollisessa kunnossa nauttimaan ansaitusta lomastasi?

Lomaennenhoito on kokonaisvaltainen hieronta, joka poistaa kuukausien aikana kertyneen stressin ja lihasjännitykset ennen lomaa. 90 minuutin hoidossa käydään läpi koko keho erityisellä huomiolla niihin alueisiin, jotka kantavat arjen stressiä – niska, hartiat, selkä, jalat.

Hoidon jälkeen moni kuvaa tunnetta, kuin olisi vihdoin voinut hengittää kunnolla. Lihakset rentoutuvat, mieli seuraa. Loma alkaa paremmin, uni on syvempää ja nauttiminen helpottuu, kun keho ei ole ylikireänä.

Lomakautena ajat täyttyvät nopeasti – varaa hoito ennen kuin lähtöpäivä lähestyy. Tarjoamme tässä kuussa kokonaisvaltaisesta hieronnasta 10% alennuksen, kun varaat ennen juhannusta.`,
    },
    {
      otsikko: 'Loman jälkeen – palautuminen! 🏊',
      ingressi: 'Aktiivinen kesäloma kuormittaa kehoa. Hieronta tekee arjen siirtymästä sujuvan.',
      tarjous: 'Heinäkuussa: Lomapalautumishieronta lyhyellä odotusajalla',
      cta: 'Varaa lomapalautuminen →',
      sisalto: `Hyvä Kuntomon asiakas,

heinäkuu on aktiivinen kuukausi. Pyöräily, uinti, vaellus, vesipelaus – kesälomalaiset liikkuvat usein enemmän kuin koko muun vuoden aikana. Se on hienoa ja terveellistä. Mutta se tarkoittaa myös, että lihakset ovat tehty töitä ja tarvitsevat huoltoa.

Lomapalautumishieronta on täsmähoito niille, jotka ovat treenanneet, liikkuneet paljon tai pitäneet kiireistä lomaa. Hieronta poistaa maitohappoja lihaksista, parantaa verenkiertoa ja nopeuttaa palautumista. Seuraava aktiviteetti – tai arki – alkaa paremmasta lähtökohdasta.

Heinäkuussa osa ajoistamme on varattuna lyhytaikaiselle varaukselle – voit soittaa myös samana päivänä ja kysyä vapaata aikaa. Pyrimme palvelemaan lomailijoita joustavasti.

Keho tekee niin kuin käsket – huolla sitä hyvin, niin se toimii paremmin. Varaa aika verkosta tai soita meille suoraan.`,
    },
    {
      otsikko: 'Lataudu syksyyn! ⚡',
      ingressi: 'Ennen syyskiirettä: kokonaisvaltainen kehonhuolto, joka maksaa itsensä takaisin.',
      tarjous: 'Elokuun lataushoito: 90 min täysinen kehonhuolto',
      cta: 'Varaa lataushoito →',
      sisalto: `Hyvä Kuntomon asiakas,

elokuu on siirtymäkuukausi. Loma on päättymässä tai jo päättynyt, arki odottaa – ja keho on usein siinä tilassa, jossa loman rentous alkaa väistyä mutta syyskiire ei ole vielä ottanut täyttä vauhtia.

Lataushoito on se panostus itseen, joka maksaa itsensä takaisin. 90 minuutin täysinen kehonhuolto, jossa käydään läpi koko keho: selkä, niska, hartiat, jalat. Hoito tasapainottaa kehon ennen syyskauden alkua – palautuminen tapahtuu nopeammin, jaksaminen on parempaa ja stressi ei tartu niin helposti.

Asiakkaat, jotka varaavat lataushoidon elokuussa, raportoivat tasaisesti parempaa energiatasoa syyskuussa. Se ei ole sattumaa – se on kehon kuuntelemista oikeaan aikaan, ennen kuin kuormitus kasvaa liian suureksi.

Paikkoja on saatavilla – mutta elokuussa varaukset täyttyvät nopeasti kun kaikki palaavat lomilta. Varaa oma aikasi ensin verkosta tai soittamalla.`,
    },
    {
      otsikko: 'Syysstressi ulos kehosta! 🍁',
      ingressi: 'Syyskuu tuo kiireet ja kortisolin. Rentouttava hieronta palauttaa jaksamisen.',
      tarjous: 'Syyskuussa: Rentouttava hieronta aromaöljyillä + hengitysharjoitus',
      cta: 'Varaa rentouttava hoito →',
      sisalto: `Hyvä Kuntomon asiakas,

syyskuu tuo mukanaan aikataulut, kokoukset, lasten koulun alkamisen ja kasvavan kuormituksen. Kortisoli – kehon stressihormoni – nousee, uni kärsii ja keho alkaa kantaa arjen painoa fyysisenä jännityksenä erityisesti niskassa, hartioissa ja selässä.

Rentouttava hieronta on todettu kliinisesti tehokkaaksi kortisolitasojen laskemisessa. Yksi hierontakerta voi laskea stressihormonin tasoja merkittävästi – ja vaikutus kestää päivistä viikkoihin säännöllisellä hoidolla. Keho ja mieli ovat yhteydessä toisiinsa: kun lihakset rentoutuvat, mieli seuraa.

Syyskuun rentouttava hieronta sisältää 60 tai 75 minuutin koko kehon hoidon rauhoittavilla aromaöljyillä. Lisäksi opastamme lyhyen hengitysharjoituksen, jota voit käyttää arjessa stressipiikin tullessa.

Investoi jaksamiseen nyt – syyskuussa tehty panostus kantaa läpi pimeimmän kauden. Varaa aika ennen kuin ruuhkakausi täyttää kalenterisi.`,
    },
    {
      otsikko: 'Pimeä syksy – keho vahvana! 🌙',
      ingressi: 'Lokakuussa immuunijärjestelmä tarvitsee tukea. Hieronta on yksi tehokkaimmista keinoista.',
      tarjous: 'Lokakuun syyshuolto: 75 min hieronta + lämmittävä aromaöljy',
      cta: 'Varaa syyshuolto →',
      sisalto: `Hyvä Kuntomon asiakas,

lokakuussa päivät lyhenevät nopeasti ja pimeys laskeutuu. Moni kokee energiatason laskua, lisääntynyttä väsymystä ja suurempaa alttiutta sairastua. Keho tarvitsee tukea selvitäkseen talvesta vahvana.

Hieronta on yksi tehokkaimmista tavoista tukea kehon immuunijärjestelmää. Verenkierron parantuessa elimistön puolustussolujen kulkeutuminen tehostuu koko kehossa. Lisäksi hieronta laskee kortisolia – korkea stressitaso on yksi merkittävimmistä immuunijärjestelmää heikentävistä tekijöistä.

Syyshuoltomme on lokakuun erityishoito: 75 minuutin koko kehon hieronta lämmittävällä aromaöljyllä, joka tukee verenkiertoa ja syvää rentoutumista. Hoito antaa keholle sen kaipaamaa huomiota ennen talvea.

Säännöllinen hoito pitää kehon toimintakykyisenä läpi talven. Varaa oma aikasi – tai hanki lahjakortti sellaiselle läheiselle, jonka hyvinvoinnista välität.`,
    },
    {
      otsikko: 'Laskettelukausi alkaa – oletko valmis? ⛷️',
      ingressi: 'Talviurheilu kuormittaa kehoa yksipuolisesti. Valmistaudu ennen ensimmäistä rinnettä.',
      tarjous: 'Talviurheiluvalmistautumishoito: Selkä, lonkat, polvet ja nilkat kuntoon',
      cta: 'Varaa valmistautumishoito →',
      sisalto: `Hyvä Kuntomon asiakas,

marraskuussa alkaa hiihtosesonki monelle suomalaiselle. Rinteille päästään ehkä vasta joulukuussa tai tammikuussa – mutta kehon valmistelu kannattaa aloittaa jo nyt.

Talviurheilu kuormittaa kehoa yllättävän yksipuolisesti. Laskettelu painottaa etureiden, pakaran ja alaraajojen lihaksia – ja tämä lihasepätasapaino yhdistettynä talven jäykkyyttä lisäävään kylmyyteen on resepti loukkaantumiselle. Yleisimmät lasketteluvammat ovat usein ehkäistävissä oikealla valmistautumisella.

Talviurheiluvalmistautumishoito kattaa ne kehon osa-alueet, jotka kantavat suurimman kuormituksen: selkä, lonkkanivelet, etureidet, polvet ja nilkat. Lihasepätasapaino kartoitetaan ja korjataan, liikkuvuus varmistetaan ennen ensimmäistä rinnettä.

Varaa hoito marraskuussa – se on parempi kuin hoitaa loukkaantumista helmikuussa. Toimiva keho antaa enemmän irti koko talvikaudesta.`,
    },
    {
      otsikko: 'Joululahja itsellesi ja läheiselle! 🎁',
      ingressi: 'Hyvinvointi on paras joululahja. Lahjakortit hierontaan – sopii kaikille ikäryhmille.',
      tarjous: 'Joulupaketit ja lahjakortit alk. 55 € | Voimassa 6 kuukautta',
      cta: 'Hanki joulupaketit →',
      sisalto: `Hyvä Kuntomon asiakas,

joulu lähestyy – ja sen kanssa ikuinen kysymys: mitä lahjaksi sille, jolle on jo kaikki?

Hyvinvointi on joululahja, josta jokainen hyötyy. Kuntomon hierontalahjapaketteja saa kaikenkokoisina ja -hintaisina: rentouttava hieronta, urheiluhieronta, fysioterapia tai yhdistelmäpaketti useammasta hoidosta. Lahjakortti on voimassa 6 kuukautta ja sopii kaikille ikäryhmille.

Meillä on valmiit joululahjapaketteja hyllyssä – kauniisti paketoituina lahjakortteina. Voit ostaa ne salilta tai tilata postitse. Sähköinen lahjakortti toimitetaan sähköpostiin välittömästi – sopii myös joulupäivän yllätyslahjalle.

Hinnat alkavat 55 eurosta yhden 60 minuutin hieronnan lahjakortille. Tarjolla on myös isommat paketit: 3 hieronnan sarja tai fysioterapia + hieronta -yhdistelmä. Hanki ajoissa – joululoman ajat varautuvat nopeasti.`,
    },
  ],
  valmennus: [
    {
      otsikko: 'Uudenvuoden tavoitteet – aloita PT-jakso! 🎯',
      ingressi: 'Uusi vuosi, uudet tavoitteet – mutta tavoitteet jäävät toiveiksi ilman suunnitelmaa.',
      tarjous: 'PT-aloituspaketti: 3 kertaa kahden hinnalla',
      cta: 'Varaa PT-tapaaminen →',
      sisalto: `Hyvä Kuntomon asiakas,

tammikuu on tavoitteiden kuukausi – mutta useimmilla tavoitteet jäävät toiveiden tasolle ilman selkeää suunnitelmaa ja tukijärjestelmää. "Haluan päästä parempaan kuntoon" ei ole tavoite. Se on toive. Tavoite on konkreettinen, mitattava ja aikataulutettu.

Henkilökohtainen valmentaja tekee tämän eron. PT:n kanssa toiveet käännetään konkreettisiksi välietapeiksi, harjoitusohjelmaksi ja seurantajärjestelmäksi. Et arvaa kehittyykö – tiedät sen, koska sitä mitataan.

Tammikuun aloituspaketti sisältää kolme PT-kertaa kahden hinnalla: alkukartoituksen ja tavoitepalaverin, ensimmäisen harjoituksen valmentajan kanssa ja viikon harjoitusohjelman itsenäistä harjoittelua varten.

Henkilökohtainen valmennus ei ole vain huippu-urheilijoille – se on tehokkain tapa saavuttaa omat tavoitteesi lähtötasosta riippumatta. Varaa alkukartoitusaika tammikuussa.`,
    },
    {
      otsikko: 'Talvifysiikka – rakennetaan perustaa! 💪',
      ingressi: 'Talvi on voiman rakentamisen parasta aikaa. Progressiivinen voimaohjelma valmentajan kanssa.',
      tarjous: 'Voimaohjelma + 2 PT-kertaa helmikuussa',
      cta: 'Aloita voimaohjelma →',
      sisalto: `Hyvä Kuntomon asiakas,

talvi on voiman ja lihasmassan rakentamisen parasta aikaa. Ulkoharrastukset ovat vähäisiä, aikataulu antaa enemmän tilaa salitreenille – ja kehon hormoniympäristö tukee lihaskasvua enemmän kuin kesällä. Tämä ei ole sattumaa: fysiikkalajien ammattilaiset rakentavat voiman juuri talvikausina.

Talvifysiikkaohjelma rakentaa vahvan pohjan koko loppuvuodelle. Valmentajasi suunnittelee progressiivisen ohjelman, joka haastaa sinua sopivasti joka viikolla – ei liikaa, ei liian vähän. Ei tylsää, ei ylikuormitusta, ei loukkaantumisia.

Helmikuun ohjelma painottaa perusvoimaharjoittelua: jalkakyykky, maastaveto, penkkipunnerrus ja leuanveto – neljä liikettä, jotka rakentavat kokonaisvaltaisen voiman paremmin kuin mikään muu yhdistelmä. Valmentaja opettaa tekniikat oikeiksi heti alusta.

Kaksi PT-kertaa helmikuussa antaa sinulle pohjan itsenäiseen harjoitteluun. Ota yhteyttä – aloitetaan talven voimaohjelma.`,
    },
    {
      otsikko: '12 viikkoa kesäkuntoon – nyt alkaa! 🌱',
      ingressi: '12 viikkoa riittää merkittävään muutokseen – jos aloitat nyt. Maaliskuu on oikea hetki.',
      tarjous: '12 viikon kesäkunto-ohjelma | Aloita maaliskuussa',
      cta: 'Aloita ohjelma →',
      sisalto: `Hyvä Kuntomon asiakas,

maaliskuu. Kesä on 12 viikkoa päässä. Tämä ei ole uhka – se on mahdollisuus.

12 viikkoa on tutkitusti optimaalinen aika merkittävälle kehon muutokselle. Tarpeeksi pitkä, jotta oikeita tuloksia syntyy. Tarpeeksi lyhyt, jotta tavoite pysyy konkreettisena koko matkan. Kuntomon 12 viikon kesäkunto-ohjelma on rakennettu tämän periaatteen pohjalle.

Valmentajasi tekee sinulle henkilökohtaisen suunnitelman ensimmäisellä kerralla. Ohjelma perustuu nykyiseen kuntotasoosi, tavoitteisiisi ja käytettävissä olevaan aikaan – ei yleiseen malliin, vaan juuri sinulle. Viikoittainen seuranta varmistaa, että kehitys jatkuu koko 12 viikon ajan.

Ohjelmaan kuuluu harjoittelu, ravinto-ohjaus ja kehon seurantamittaukset. 12 viikon päätteeksi näet tulokset konkreettisesti – ei vain peilistä, vaan numeroina.

Paikkoja on rajallinen määrä. Aloita maaliskuussa – viikko myöhemmin tarkoittaa viikkoa vähemmän ennen kesää.`,
    },
    {
      otsikko: 'Sprint to Summer – puolessa välissä! 🏃',
      ingressi: 'Jos aloitit maaliskuussa, olet puolessa välissä. Väliarviointi – ja viimeinen hetki aloittaa.',
      tarjous: 'Väliarviointi ilmaiseksi nykyisille asiakkaille | 8 vk pikakiri uusille',
      cta: 'Varaa väliarviointi →',
      sisalto: `Hyvä Kuntomon asiakas,

jos aloitit 12 viikon ohjelman maaliskuussa – olet nyt puolessa välissä. Neljä viikkoa tehty, kahdeksan jäljellä. Tämä on se kriittinen hetki, jolloin useimmat joko ottavat lisää vauhtia tai alkavat lipsua. Kumpaan suuntaan menet?

Väliarviointi kuuluu ohjelmaan – ja nyt on sen aika. Mitataan missä ollaan: kehon koostumus, voima, kestävyys. Katsotaan, mikä on toiminut ja mikä ei. Päivitetään ohjelma loppumatkaa varten.

Ei aloittanut maaliskuussa? Vielä on aikaa. Kahdeksassa viikossa ehtii tehdä selvästi havaittavan muutoksen – erityisesti jos aloituspiste on nolla. PT suunnittelee tiivistetyn version, joka maksimoi tulokset jäljellä olevalla ajalla.

Ota yhteyttä tai varaa väliarviointi suoraan kalenteristamme. Loppukiriin on vielä reilusti aikaa.`,
    },
    {
      otsikko: 'Viimeinen kiri ennen kesää! 🌸',
      ingressi: 'Toukokuu on motivaation huippu – ja PT:n tärkein kuukausi. Tehopaketti viimeiselle kirille.',
      tarjous: 'Toukokuun PT-tehopaketti: 4 kertaa intensiivisesti',
      cta: 'Varaa tehopaketti →',
      sisalto: `Hyvä Kuntomon asiakas,

toukokuu. Kesään on neljästä kuuteen viikkoa. Nyt tehdään ne viimeiset muutokset – tai aloitetaan, jos siltä tuntuu.

Toukokuu on motivaation huippu. Kesä on niin lähellä, että tuntuu. Tämä on PT:n työssä se kuukausi, jolloin asiakkaat antavat eniten itsestään – ja jolloin tulokset siksi ovat näkyvimpiä. Vähän enemmän intensiteettiä juuri nyt tuottaa paljon enemmän kuin sama määrä työtä tammikuussa.

Tehopaketti sisältää neljä PT-kertaa toukokuussa. Harjoitukset ovat vaativampia, palautumiseen panostetaan enemmän ja ravinto-ohjaus täsmentyy viimeisille viikoille. Tavoite on selkeä: tunnet ja näytät olevasi parhaimmillasi kesäkuun alussa.

Varoitus: tehopaketti vaatii sitoutumista. Se sopii, jos olet valmis antamaan viisi viikkoa määrätietoisesti. Jos olet valmis, me olemme valmiita. Varaa paikka nyt.`,
    },
    {
      otsikko: 'Kesä on täällä – pysy liikkeessä! ☀️',
      ingressi: 'Kesä haastaa arkirutiinit. Joustavat ajat, ulkotreenit ja etävalmennus pitävät sinut liikkeessä.',
      tarjous: 'Kesäohjelma + etävalmennus | Koko kesäkuukaudelle',
      cta: 'Hanki kesäohjelma →',
      sisalto: `Hyvä Kuntomon asiakas,

kesä on täällä – ja sen kanssa tulee suurin haaste: pitää kiinni rutiineista, kun kaikki muu muuttuu. Lomat, juhannusjuhlat, ulkoilu, myöhäiset illat – kesä on ihana, mutta se tekee arkirutiineista haastavampia kuin mikään muu vuodenaika.

Kuntomon kesäohjelma on suunniteltu juuri tähän. Joustavat aikataulut sopivat kesälaiseen rytmiin. Osa harjoituksista voidaan tehdä ulkona. Etävalmennus mahdollistaa treenin myös reissussa – lähetä harjoituspäiväkirjasi valmentajallesi vaikka ulkomailta.

Kesäohjelman asiakkaat pitävät tuloksensa läpi kesän ja aloittavat syksyn paremmasta lähtökohdasta kuin ne, jotka pitävät kesätauon. Kaksi kuukautta taukoa tarkoittaa usein kuusi viikkoa palautumisaikaa syksyllä.

Kysy valmentajaltasi kesäohjelmaa tai ota yhteyttä meille. Suunnitellaan juuri sinulle sopiva tapa pitää liike yllä koko kesä.`,
    },
    {
      otsikko: 'Lomaharjoitusohjelma – treenaa missä tahansa! 🏖️',
      ingressi: 'Lomaohjelma ilmaiseksi kaikille PT-asiakkaille. Toimii hotellihuoneessa, rannalla ja mökillä.',
      tarjous: 'Lomaohjelma ilmaiseksi kaikille aktiivisille PT-asiakkaille',
      cta: 'Pyydä lomaohjelma →',
      sisalto: `Hyvä Kuntomon asiakas,

loma on se aika, jolloin luvataan itselle: tänä kesänä en anna treenirutiinin murtua. Mutta ilman konkreettista suunnitelmaa lupaus jää lupauksen tasolle – ja syyskuussa lähdetään taas alusta.

Lomaohjelma on PT:n suunnittelema harjoitussarja, joka ei vaadi kuntosalia, erikoisvälineitä tai tarkkaa aikataulua. Se toimii hotellihuoneessa, rannalla, mökin pihalla tai puistossa missä päin maailmaa olet. Ohjelma kestää 20–40 minuuttia per harjoitus, ja harjoituksia on neljä viikossa – lomatahtiin täydellisesti sopivasti.

Jokaiselle aktiiviselle PT-asiakkaalle lomaohjelma kuuluu palveluun ilmaiseksi – pyydä sitä valmentajaltasi ennen loman alkua.

Loma on myös loistava aika kokeilla uusia lajeja: ulkojuoksua, pyöräilyä, uintia, melontaa. Valmentaja antaa vinkkejä miten nämä sopivat harjoituskokonaisuuteen. Nauti lomasta – ja loma nauttii paremmasta sinusta.`,
    },
    {
      otsikko: 'Syyskauden aloitus – uusi ohjelma! 🍂',
      ingressi: 'Elokuu on toinen tammikuu. Aloita syyskausi vahvasti – uusi ohjelma, uudet tavoitteet.',
      tarjous: 'Syyskauden aloituspaketti: 3 PT-kertaa | Alkukartoitus + ohjelma + ensimmäinen treeni',
      cta: 'Aloita syyskausi →',
      sisalto: `Hyvä Kuntomon asiakas,

elokuu on toinen tammikuu. Loma on ohi, arki odottaa – ja motivaatio on monella korkeimmillaan sitten uudenvuoden. Tämä on ikkuna, joka kannattaa käyttää: muutokselle on tilaa, energiaa on uusiutunut ja arki tarjoaa jälleen rakenteet säännölliselle liikunnalle.

Syyskauden aloituspaketti käynnistää kauden kolmessa PT-kerrassa: alkukartoitus (missä ollaan nyt), tavoitepalaveri (mihin mennään) ja ensimmäinen harjoitus uuden ohjelman kanssa (miten päästään sinne). Lähdet käyntiin paljon nopeammin kuin yksin aloittaessa.

Syyskaudelle rakennettu ohjelma on pitkäjänteinen projekti: kolme kuukautta ennen joulua on tarpeeksi aikaa merkittäviin muutoksiin. Valmentaja pitää motivaation yllä myös niinä viikkoina, jolloin se on alhaisimmillaan.

Elokuu on paras hetki aloittaa – ennen kuin syysrutiinit muodostuvat ilman liikuntaa. Ota yhteyttä tai varaa aika suoraan verkkokalenteristamme.`,
    },
    {
      otsikko: 'Q4-tavoitesuunnitelma – 4 kuukautta jäljellä! 🎯',
      ingressi: 'Vuodesta on jäljellä 4 kuukautta. Ilmainen suunnitelmapalaveri PT:n kanssa.',
      tarjous: 'Q4-suunnitelmapalaveri PT:n kanssa – ilmainen | Syyskuussa',
      cta: 'Varaa suunnitelmapalaveri →',
      sisalto: `Hyvä Kuntomon asiakas,

neljä kuukautta. Se on se, mitä kalenterivuodesta on jäljellä syyskuun alussa. Mitä teet niillä?

Q4-tavoitesuunnitelmapalaveri on ilmainen tunnin tapaaminen PT:n kanssa, jossa katsotaan läpi: mitä tänä vuonna on saavutettu, mitä tavoitteita on vielä jäljellä ja miten ne realistisesti saavutetaan ennen vuoden vaihtumista. Palaveri ei sitouta mihinkään – se antaa selkeän suunnitelman, jonka voit toteuttaa itse tai PT:n kanssa.

Palaveri on tarkoitettu sekä nykyisille PT-asiakkaille väliarvioinnin muodossa että uusille, jotka harkitsevat aloittamista. Tunnin tapaaminen antaa paljon enemmän kuin yksin pohdittu suunnitelma.

Syyskuu on psykologisesti vahvaa aikaa tavoitteiden asettamiselle. Käytä se ikkuna – varaa Q4-suunnitelmapalaveri tässä kuussa.`,
    },
    {
      otsikko: 'Kuntotesti & väliarviointi – missä olet? 📊',
      ingressi: 'Lokakuussa mitataan. Kehon koostumus, voima, kestävyys – data ei valehtele.',
      tarjous: 'Kuntotesti + ohjelmapalaveri PT:n kanssa',
      cta: 'Varaa kuntotesti →',
      sisalto: `Hyvä Kuntomon asiakas,

lokakuussa tehdään se, mitä monet välttelevät mutta kaikki tarvitsevat: mitataan tarkasti, missä mennään.

Kuntotesti kertoo kehon koostumuksen (lihasmassa, rasvaprosentti), aerobisen kunnon, voimatason ja liikkuvuuden. Tulokset eivät valehtele – ne kertovat täsmälleen, missä on edistytty ja missä on parannettavaa. Monille testaus on motivoiva kokemus: näkee konkreettisesti mitä useamman kuukauden työ on tuottanut.

Väliarviointi yhdistettynä kuntotestiin on tehokkain tapa varmistaa, että vuoden lopun tavoitteet saavutetaan. Ohjelma päivitetään tulosten perusteella. Usein tässä vaiheessa löydetään ne pullonkaulat, joita ei ilman mittauksia löydettäisi.

Kuntotesti + ohjelmapalaveri -paketti sisältää täyden kehon koostumusmittauksen, kuntotestitulokset kirjallisena ja ohjelmapalaverin PT:n kanssa. Varaa paikkasi – testejä tehdään rajoitettu määrä viikossa.`,
    },
    {
      otsikko: 'Pre-Christmas – pysy kurssilla! 🎄',
      ingressi: 'Marraskuu on haastavin kuukausi pysyä rutiineissa. PT:n asiakkaat eivät anna periksi.',
      tarjous: 'Marraskuun motivaatiopaketti: 2 PT-kertaa strategisesti sijoitettuna',
      cta: 'Varaa motivaatiokerrat →',
      sisalto: `Hyvä Kuntomon asiakas,

marraskuu–joulukuu on se aika, jolloin liikuntarutiinit useimmiten katkeavat. Joulujuhlat, adventtikalenterit, kiireet töissä, pimeys, väsymys – jokainen näistä antaa yhden syyn lykätä. Viisi syytä yhteen kuukauteen on paljon. Ja sitten on tammikuu, ja lähdetään taas alusta.

PT:n asiakkaat eivät tee näin. Valmentaja pitää aikataulun kiinni myös joulukuukausina – joustaa tarvittaessa, muttei anna lipsua kokonaan. Ne jotka treenaavat läpi joulun ovat tammikuussa jo kolmesta kuuteen viikkoa edellä muita.

Marraskuun motivaatiopaketti sisältää kaksi PT-kertaa strategisesti sijoitettuna kuukauden kiireisimpiin kohtiin. Valmentaja myös suunnittelee kotiohjelman niille viikoille, jolloin salikäynti on mahdotonta.

Älä anna joululomista tulla treenivapaata. Ota yhteyttä – suunnitellaan marraskuu ja joulukuu yhdessä.`,
    },
    {
      otsikko: 'Vuoden huipennus & suunnitelma ensi vuodelle! 🎆',
      ingressi: 'Joulukuu: katsotaan vuoden tulokset läpi ja rakennetaan suunnitelma ensi vuodelle.',
      tarjous: 'Vuosipalaveri PT:n kanssa + ensi vuoden aloituspaketti edullisemmin',
      cta: 'Varaa vuosipalaveri →',
      sisalto: `Hyvä Kuntomon asiakas,

joulukuu on se hetki, jolloin kannattaa pysähtyä. Mitä tänä vuonna saavutettiin? Mitä jäi saavuttamatta – ja miksi? Mitä ensi vuodelta halutaan?

Vuosipalaveri PT:n kanssa on joulukuun tärkein tapaaminen. Käymme läpi koko vuoden tulokset, analysoimme mikä toimi ja mikä ei, ja rakennamme alustavan suunnitelman ensi vuodelle. Lähdet tammikuuhun suunnitelma käsissä – ei tyhjänä lehtenä, vaan tiedon ja konkreettisen polun kanssa.

Niille, jotka eivät ole vielä aloittaneet henkilökohtaista valmennusta: joulukuussa solmittu jäsenyys tarkoittaa, että tammikuun ruuhka ei koske sinua. Olet jo edellä – alkukartoitus on takana, suunnitelma on tehty.

Ensi vuoden aloituspaketti on edullisempi, kun sopimus solmitaan joulukuussa. Varaa vuosipalaveri tai ensimmäinen tapaaminen – aloitetaan ensi vuosi valmiimmin ja tietoisemmin kuin koskaan.`,
    },
  ],
}

function polar(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
function arc(cx, cy, r1, r2, a1, a2) {
  const p1 = polar(cx, cy, r2, a1), p2 = polar(cx, cy, r2, a2)
  const p3 = polar(cx, cy, r1, a2), p4 = polar(cx, cy, r1, a1)
  const lg = a2 - a1 > 180 ? 1 : 0
  return `M${p1.x},${p1.y} A${r2},${r2},0,${lg},1,${p2.x},${p2.y} L${p3.x},${p3.y} A${r1},${r1},0,${lg},0,${p4.x},${p4.y}Z`
}

function YearWheel() {
  const cx = 250, cy = 250
  const rings = [
    { r1: 72, r2: 122, label: 'Kuntosali', color: '#7a0251' },
    { r1: 127, r2: 177, label: 'Hieronta & Ft', color: '#c2410c' },
    { r1: 182, r2: 232, label: 'Valmennus', color: '#0369a1' },
  ]
  const seasonColor = (i) => {
    if ([11, 0, 1].includes(i)) return '#bfdbfe'
    if ([2, 3, 4].includes(i)) return '#bbf7d0'
    if ([5, 6, 7].includes(i)) return '#fef08a'
    return '#fed7aa'
  }
  const [hovered, setHovered] = useState(null)

  return (
    <div className="grid-cols-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
      <svg viewBox="0 0 500 500" style={{ width: '100%', maxWidth: 460 }}>
        {MONTH_NAMES.map((_, mi) => {
          const a1 = mi * 30, a2 = (mi + 1) * 30 - 1
          const base = seasonColor(mi)
          return rings.map((ring, ri) => {
            const id = `${mi}-${ri}`
            const isHov = hovered === id
            return (
              <path key={id} d={arc(cx, cy, ring.r1, ring.r2, a1, a2)}
                fill={isHov ? ring.color : base}
                stroke="white" strokeWidth={1.5}
                style={{ cursor: 'pointer', transition: 'fill .15s', opacity: isHov ? 1 : 0.82 + ri * 0.06 }}
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered(null)}
              />
            )
          })
        })}
        {MONTH_NAMES.map((name, mi) => {
          const pt = polar(cx, cy, 248, mi * 30 + 15)
          return (
            <text key={mi} x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="middle"
              fontSize="10.5" fontWeight="700" fill="#374151"
              transform={`rotate(${mi * 30 + 15},${pt.x},${pt.y})`}>
              {MONTH_SHORT[mi]}
            </text>
          )
        })}
        {rings.map((ring, ri) => {
          const pt = polar(cx, cy, (ring.r1 + ring.r2) / 2, 90)
          return (
            <text key={ri} x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fontWeight="700" fill={ring.color}>
              {ri === 0 ? 'K' : ri === 1 ? 'H' : 'V'}
            </text>
          )
        })}
        <circle cx={cx} cy={cy} r={67} fill="white" stroke="#e5e7eb" strokeWidth={1} />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize="11" fontWeight="800" fill="#7c3aed">KUNTOMO</text>
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize="9.5" fill="#6b7280">Markkinointi</text>
        <text x={cx} y={cy + 20} textAnchor="middle" fontSize="9" fill="#9ca3af">Vuosiympyrä</text>
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: '.5rem' }}>Kehät</div>
          {rings.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.3rem' }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: r.color, flexShrink: 0 }} />
              <span style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text2)' }}>{['Sisäkehä', 'Keskikehä', 'Ulkokehä'][i]}: {r.label}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: '.5rem' }}>Värit = Kausi</div>
          {Object.values(SEASON_THEMES).map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.3rem' }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: s.color, border: '1px solid #e5e7eb', flexShrink: 0 }} />
              <span style={{ fontSize: '.82rem', color: 'var(--text2)' }}>{s.emoji} {s.label} ({s.months})</span>
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '1rem', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text2)', marginBottom: '.5rem' }}>Kausikohtaiset teemat</div>
          {Object.values(SEASON_THEMES).map(s => (
            <div key={s.label} style={{ marginBottom: '.65rem' }}>
              <div style={{ fontSize: '.78rem', fontWeight: 700, color: s.dark, marginBottom: '.2rem' }}>{s.emoji} {s.label}</div>
              {['kuntosali', 'hieronta', 'valmennus'].map(area => (
                <div key={area} style={{ fontSize: '.72rem', color: 'var(--text3)', marginLeft: '.75rem', marginBottom: '.1rem' }}>
                  <span style={{ color: ALUEET.find(a => a.key === area)?.color, fontWeight: 600 }}>
                    {ALUEET.find(a => a.key === area)?.label.split(' ')[0]}:
                  </span>{' '}
                  {s[area]?.teema}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const emptyNl = { otsikko: '', ingressi: '', sisalto: '', tarjous: '', cta: '' }

function KuukausikirjeetTab() {
  const { isAdmin } = useAuth()
  const [alue, setAlue] = useState('kuntosali')
  const [month, setMonth] = useState(new Date().getMonth())
  const [overrides, setOverrides] = useState({})   // key: `${alue}-${month}`, val: newsletter obj
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState(emptyNl)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchOverrides = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('marketing_newsletters').select('*')
    const map = {}
    ;(data || []).forEach(r => { map[`${r.alue}-${r.month_idx}`] = r })
    setOverrides(map)
    setLoading(false)
  }, [])

  useEffect(() => { fetchOverrides() }, [fetchOverrides])

  const key = `${alue}-${month}`
  const base = NEWSLETTERS[alue]?.[month] || emptyNl
  const nl = overrides[key] ? { ...base, ...overrides[key] } : base
  const areaObj = ALUEET.find(a => a.key === alue)

  function openEdit() {
    setEditForm({ otsikko: nl.otsikko, ingressi: nl.ingressi, sisalto: nl.sisalto, tarjous: nl.tarjous, cta: nl.cta })
    setEditModal(true)
  }

  async function handleEditSave() {
    setSaving(true)
    const payload = { alue, month_idx: month, ...editForm }
    await supabase.from('marketing_newsletters').upsert(payload, { onConflict: 'alue,month_idx' })
    await fetchOverrides()
    setSaving(false)
    setEditModal(false)
  }

  async function handleReset() {
    if (!confirm('Palautetaanko oletusteksti?')) return
    await supabase.from('marketing_newsletters').delete().match({ alue, month_idx: month })
    await fetchOverrides()
  }

  function copyText() {
    const txt = `${nl.otsikko}\n\n${nl.ingressi}\n\n${nl.sisalto}\n\n${nl.tarjous}\n\n${nl.cta}`
    navigator.clipboard.writeText(txt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isCustomized = !!overrides[key]

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {ALUEET.map(({ key: k, label, color }) => (
          <button key={k} onClick={() => setAlue(k)} style={{
            padding: '.35rem .85rem', borderRadius: 99, fontSize: '.82rem', fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${alue === k ? color : 'var(--border)'}`,
            background: alue === k ? `${color}18` : 'transparent',
            color: alue === k ? color : 'var(--text3)',
          }}>{label}</button>
        ))}
        <select className="input-field" style={{ width: 'auto', fontSize: '.82rem', padding: '.35rem .6rem', height: 'auto', marginLeft: 'auto' }}
          value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
      </div>

      {loading ? <p style={{ color: 'var(--text3)', fontSize: '.85rem' }}>Ladataan...</p> : (
        <div className="grid-cols-2" style={{ gap: '1.25rem' }}>
          {/* Newsletter preview */}
          <div className="card" style={{ padding: '1.5rem', position: 'relative' }}>
            {/* Action bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: areaObj?.color }}>
                {areaObj?.label} · {MONTH_NAMES[month]}
                {isCustomized && <span style={{ marginLeft: '.5rem', background: areaObj?.color + '22', color: areaObj?.color, borderRadius: 99, padding: '1px 7px', fontSize: '.6rem' }}>Muokattu</span>}
              </div>
              <div style={{ display: 'flex', gap: '.35rem' }}>
                <button onClick={copyText} title="Kopioi teksti" style={{ display: 'flex', alignItems: 'center', gap: '.3rem', padding: '.3rem .65rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg2)', cursor: 'pointer', fontSize: '.75rem', color: 'var(--text2)', fontWeight: 600 }}>
                  {copied ? <><Check size={12} /> Kopioitu!</> : <><Copy size={12} /> Kopioi</>}
                </button>
                {isAdmin && (
                  <>
                    <button onClick={openEdit} title="Muokkaa" style={{ display: 'flex', alignItems: 'center', gap: '.3rem', padding: '.3rem .65rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg2)', cursor: 'pointer', fontSize: '.75rem', color: 'var(--text2)', fontWeight: 600 }}>
                      <Edit2 size={12} /> Muokkaa
                    </button>
                    {isCustomized && (
                      <button onClick={handleReset} title="Palauta oletusteksti" style={{ padding: '.3rem .65rem', border: '1px solid #fecaca', borderRadius: 'var(--radius)', background: '#fef2f2', cursor: 'pointer', fontSize: '.75rem', color: 'var(--red)', fontWeight: 600 }}>
                        Palauta
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.25rem', marginBottom: '.35rem', lineHeight: 1.3 }}>
              {nl.otsikko}
            </h2>
            <p style={{ fontSize: '.9rem', color: 'var(--text2)', fontStyle: 'italic', marginBottom: '1rem' }}>{nl.ingressi}</p>
            <p style={{ fontSize: '.85rem', color: 'var(--text)', lineHeight: 1.65, marginBottom: '1.25rem', whiteSpace: 'pre-wrap' }}>{nl.sisalto}</p>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.85rem 1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: '.25rem' }}>Tarjous</div>
              <div style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--violet)' }}>{nl.tarjous}</div>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', padding: '.45rem 1rem', background: areaObj?.color, color: 'white', borderRadius: 99, fontSize: '.82rem', fontWeight: 700 }}>
              {nl.cta}
            </div>
          </div>

          {/* Side panels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: '.5rem' }}>Kauden teema</div>
              {(() => {
                const season = [11, 0, 1].includes(month) ? 'talvi' : [2, 3, 4].includes(month) ? 'kevät' : [5, 6, 7].includes(month) ? 'kesä' : 'syksy'
                const s = SEASON_THEMES[season]
                return (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '.35rem' }}>{s.emoji} {s.label} · {s.months}</div>
                    <div style={{ fontSize: '.8rem', color: areaObj?.color, fontWeight: 600, marginBottom: '.35rem' }}>{s[alue]?.teema}</div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
                      {s[alue]?.viestit.map((v, i) => <li key={i} style={{ fontSize: '.78rem', color: 'var(--text3)' }}>{v}</li>)}
                    </ul>
                  </div>
                )
              })()}
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: '.5rem' }}>Kaikki alueet – {MONTH_NAMES[month]}</div>
              {ALUEET.map(a => {
                const dbNl = overrides[`${a.key}-${month}`]
                const nl2 = dbNl ? { ...NEWSLETTERS[a.key]?.[month], ...dbNl } : NEWSLETTERS[a.key]?.[month]
                if (!nl2) return null
                return (
                  <div key={a.key} style={{ marginBottom: '.5rem', paddingBottom: '.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: a.color, marginBottom: '.12rem' }}>{a.label}</div>
                    <div style={{ fontSize: '.78rem', color: 'var(--text2)' }}>{nl2.otsikko}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--violet)', fontWeight: 600, marginTop: '.1rem' }}>{nl2.tarjous}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <Modal
          title={`Muokkaa kirjettä — ${areaObj?.label} · ${MONTH_NAMES[month]}`}
          onClose={() => setEditModal(false)}
          wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditModal(false)}>Peruuta</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={saving}>
                {saving ? 'Tallennetaan...' : 'Tallenna'}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Otsikko</label>
              <input className="input-field" value={editForm.otsikko} onChange={e => setEditForm(f => ({ ...f, otsikko: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Ingressi (lyhyt kuvaus / esikatselu)</label>
              <input className="input-field" value={editForm.ingressi} onChange={e => setEditForm(f => ({ ...f, ingressi: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Sisältö</label>
              <textarea className="input-field" rows={6} value={editForm.sisalto} onChange={e => setEditForm(f => ({ ...f, sisalto: e.target.value }))} style={{ resize: 'vertical', lineHeight: 1.6 }} />
            </div>
            <div className="input-group">
              <label className="input-label">Tarjous</label>
              <input className="input-field" value={editForm.tarjous} onChange={e => setEditForm(f => ({ ...f, tarjous: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">CTA-painike teksti</label>
              <input className="input-field" value={editForm.cta} onChange={e => setEditForm(f => ({ ...f, cta: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

const CATEGORY_TYPES = ['Kampanja', 'Lanseeraus', 'Tarjous', 'Tapahtuma', 'Some-sisältö', 'Muu']
const CATEGORY_COLORS = {
  'Kampanja': '#7a0251', 'Lanseeraus': '#c2410c', 'Tarjous': '#0369a1',
  'Tapahtuma': '#059669', 'Some-sisältö': '#7c3aed', 'Muu': '#6b7280',
}

const emptyMark = {
  title: '', alue: ALUEET[0].key, month: String(new Date().getMonth() + 1),
  description: '', category_type: 'Kampanja', event_date: '',
}

function getSeasonForMonth(m) {
  if ([11, 0, 1].includes(m)) return 'talvi'
  if ([2, 3, 4].includes(m)) return 'kevät'
  if ([5, 6, 7].includes(m)) return 'kesä'
  return 'syksy'
}

function MarkkinointiTab() {
  const { user } = useAuth()
  const [subTab, setSubTab] = useState('kalenteri')
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
      category: form.alue,
      month: parseInt(form.month),
      description: form.description.trim() || null,
      category_type: form.category_type,
      event_date: form.event_date || null,
      created_by: user?.id || null,
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
    if (filterAlue && e.category !== filterAlue) return false
    if (filterCategory && e.category_type !== filterCategory) return false
    return true
  })

  const curMonth = new Date().getMonth()
  const curYear = new Date().getFullYear()

  const subNav = (
    <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
      {[['kalenteri', 'Kalenteri'], ['ympyrä', 'Vuosiympyrä'], ['kirjeet', 'Kuukausikirjeet']].map(([k, l]) => (
        <button key={k} className={`sub-tab${subTab === k ? ' active' : ''}`} onClick={() => setSubTab(k)}>{l}</button>
      ))}
    </div>
  )

  if (subTab === 'ympyrä') return <div>{subNav}<YearWheel /></div>
  if (subTab === 'kirjeet') return <div>{subNav}<KuukausikirjeetTab /></div>

  return (
    <>
      {subNav}
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
        <div className="grid-cols-4">
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
                    const alue = ALUEET.find(a => a.key === e.category)
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

                  {/* ── Kuukausikirjeet & Teemat ── */}
                  {(() => {
                    const season = getSeasonForMonth(i)
                    const seasonObj = SEASON_THEMES[season]
                    const alueetToShow = filterAlue ? [ALUEET.find(a => a.key === filterAlue)] : ALUEET
                    return (
                      <div style={{ borderTop: monthEvts.length > 0 ? '1px solid var(--border)' : 'none', marginTop: monthEvts.length > 0 ? '.3rem' : 0, paddingTop: monthEvts.length > 0 ? '.35rem' : 0, display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                        {alueetToShow.map(a => {
                          if (!a) return null
                          const teema = seasonObj?.[a.key]?.teema
                          const nl = NEWSLETTERS[a.key]?.[i]
                          return (
                            <div key={a.key} style={{ display: 'flex', flexDirection: 'column', gap: '.18rem' }}>
                              {!filterAlue && (
                                <span style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: a.color, opacity: .85 }}>
                                  {a.label}
                                </span>
                              )}
                              {teema && (
                                <div style={{ display: 'flex', gap: '.3rem', alignItems: 'flex-start' }}>
                                  <span style={{ fontSize: '.6rem', fontWeight: 700, color: seasonObj?.dark || 'var(--text3)', background: seasonObj?.color, borderRadius: 3, padding: '1px 5px', flexShrink: 0, lineHeight: 1.7 }}>
                                    Teema
                                  </span>
                                  <span style={{ fontSize: '.68rem', color: 'var(--text2)', lineHeight: 1.4 }}>{teema}</span>
                                </div>
                              )}
                              {nl?.otsikko && (
                                <div style={{ display: 'flex', gap: '.3rem', alignItems: 'flex-start' }}>
                                  <span style={{ fontSize: '.6rem', fontWeight: 700, color: '#fff', background: a.color, borderRadius: 3, padding: '1px 5px', flexShrink: 0, lineHeight: 1.7 }}>
                                    Kirje
                                  </span>
                                  <span style={{ fontSize: '.68rem', color: 'var(--text2)', lineHeight: 1.4 }}>{nl.otsikko}</span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && subTab === 'kalenteri' && (
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
          <p className="page-subtitle">Tapahtumat ja markkinointi </p>
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
