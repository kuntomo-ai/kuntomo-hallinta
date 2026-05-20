import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'
import VoiceMicButton, { parseVoiceAjo, parseVoiceWorkTime } from '../components/VoiceInput'

const TODAY = new Date().toISOString().slice(0, 10)

// ─── Ajokirjaus tab ───────────────────────────────────────────────────────────

const emptyDrive = { driver_name: '', from_location: '', to_location: '', distance_km: '', odometer_before: '', odometer_after: '', notes: '' }

function AjokirjausTab({ isAdmin, myName }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyDrive)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ today: 0, month: 0, monthCount: 0 })

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    function onVoiceTimelog(e) {
      setEditing(null)
      setForm({ ...emptyDrive, driver_name: myName, ...e.detail })
      setShowModal(true)
    }
    window.addEventListener('voice-timelog', onVoiceTimelog)
    return () => window.removeEventListener('voice-timelog', onVoiceTimelog)
  }, [myName])

  async function fetchData() {
    setLoading(true)
    let q = supabase.from('drive_logs').select('*').order('created_at', { ascending: false })
    if (!isAdmin) q = q.eq('driver_name', myName)
    const { data } = await q
    setRows(data || [])
    const today = new Date().toISOString().slice(0, 10)
    const monthStart = new Date().toISOString().slice(0, 7)
    const todayKm = (data || []).filter(r => r.created_at?.slice(0, 10) === today).reduce((s, r) => s + (r.distance_km || 0), 0)
    const monthRows = (data || []).filter(r => r.created_at?.slice(0, 7) === monthStart)
    setStats({ today: todayKm, month: monthRows.reduce((s, r) => s + (r.distance_km || 0), 0), monthCount: monthRows.length })
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm({ ...emptyDrive, driver_name: myName })
    setShowModal(true)
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      driver_name: row.driver_name || '',
      from_location: row.from_location || '',
      to_location: row.to_location || '',
      distance_km: row.distance_km != null ? String(row.distance_km) : '',
      odometer_before: row.odometer_before != null ? String(row.odometer_before) : '',
      odometer_after: row.odometer_after != null ? String(row.odometer_after) : '',
      notes: row.notes || '',
    })
    setShowModal(true)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => {
      const u = { ...f, [name]: value }
      if (name === 'odometer_before' || name === 'distance_km') {
        const b = parseFloat(u.odometer_before), d = parseFloat(u.distance_km)
        if (!isNaN(b) && !isNaN(d)) u.odometer_after = (b + d).toFixed(1)
      }
      return u
    })
  }

  async function handleSave() {
    if (!form.driver_name.trim() || !form.from_location.trim() || !form.to_location.trim()) return
    setSaving(true)
    const payload = {
      driver_name: form.driver_name.trim(),
      from_location: form.from_location.trim(),
      to_location: form.to_location.trim(),
      distance_km: form.distance_km ? parseFloat(form.distance_km) : null,
      odometer_before: form.odometer_before ? parseFloat(form.odometer_before) : null,
      odometer_after: form.odometer_after ? parseFloat(form.odometer_after) : null,
      notes: form.notes.trim() || null,
    }
    if (editing) await supabase.from('drive_logs').update(payload).eq('id', editing)
    else await supabase.from('drive_logs').insert(payload)
    setSaving(false)
    setShowModal(false)
    setEditing(null)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko ajokirjaus?')) return
    await supabase.from('drive_logs').delete().eq('id', id)
    fetchData()
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Uusi ajokirjaus</button>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card"><div className="stat-label">Ajettu tänään</div><div className="stat-value">{stats.today.toFixed(1)} km</div></div>
        <div className="stat-card"><div className="stat-label">Tämä kuukausi</div><div className="stat-value">{stats.month.toFixed(1)} km</div></div>
        <div className="stat-card"><div className="stat-label">Kirjauksia kk</div><div className="stat-value">{stats.monthCount}</div></div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pvm</th>
              {isAdmin && <th>Kuljettaja</th>}
              <th>Lähtöpaikka</th>
              <th>Määränpää</th>
              <th>Matka</th>
              <th>Mittari ennen</th>
              <th>Mittari jälkeen</th>
              <th>Muistiinpanot</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 9 : 8} className="table-empty">Ladataan...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={isAdmin ? 9 : 8} className="table-empty">Ei ajokirjauksia.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: '.78rem' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</td>
                {isAdmin && <td style={{ fontWeight: 600 }}>{r.driver_name}</td>}
                <td>{r.from_location}</td>
                <td>{r.to_location}</td>
                <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{r.distance_km != null ? r.distance_km + ' km' : '—'}</td>
                <td style={{ color: 'var(--text3)' }}>{r.odometer_before ?? '—'}</td>
                <td style={{ color: 'var(--text3)' }}>{r.odometer_after ?? '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 140 }}>{r.notes || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><Edit2 size={13} /></button>
                    {(isAdmin || r.driver_name === myName) && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Muokkaa ajokirjausta' : 'Uusi ajokirjaus'} onClose={() => setShowModal(false)} footer={
          <>
            <VoiceMicButton label="Puhekirjaus" onResult={text => {
              const parsed = parseVoiceAjo(text)
              setForm(f => ({ ...f, ...parsed }))
            }} />
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Tallennetaan...' : 'Tallenna'}</button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Kuljettaja</label>
              <input className="input-field" name="driver_name" placeholder="Etunimi Sukunimi" value={form.driver_name} onChange={handleChange} readOnly={!isAdmin} style={!isAdmin ? { background: 'var(--bg3)' } : {}} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Lähtöpaikka</label>
                <input className="input-field" name="from_location" placeholder="Lähtöpaikka" value={form.from_location} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Määränpää</label>
                <input className="input-field" name="to_location" placeholder="Määränpää" value={form.to_location} onChange={handleChange} />
              </div>
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Mittarilukema ennen</label>
                <input className="input-field" name="odometer_before" type="number" step="0.1" placeholder="km" value={form.odometer_before} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Matka (km)</label>
                <input className="input-field" name="distance_km" type="number" step="0.1" placeholder="24.5" value={form.distance_km} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Mittarilukema jälkeen (lasketaan automaattisesti)</label>
              <input className="input-field" name="odometer_after" type="number" step="0.1" value={form.odometer_after} readOnly style={{ background: 'var(--bg3)' }} />
            </div>
            <div className="input-group">
              <label className="input-label">Muistiinpanot</label>
              <textarea className="input-field" name="notes" rows={2} value={form.notes} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── Työaikakirjaus tab ───────────────────────────────────────────────────────

const emptyWork = { employee_name: '', work_date: TODAY, start_time: '', end_time: '', break_minutes: '0', notes: '' }

function WorkTimeTab({ isAdmin, myName }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyWork)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    let q = supabase.from('work_time_logs').select('*').order('work_date', { ascending: false }).order('start_time', { ascending: false })
    if (!isAdmin) q = q.eq('employee_name', myName)
    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }

  function calcHours(start, end, breakMin) {
    if (!start || !end) return null
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const mins = (eh * 60 + em) - (sh * 60 + sm) - (parseInt(breakMin) || 0)
    if (mins <= 0) return null
    return (mins / 60).toFixed(2)
  }

  function openNew() {
    setEditing(null)
    setForm({ ...emptyWork, employee_name: myName })
    setShowModal(true)
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      employee_name: row.employee_name || '',
      work_date: row.work_date || TODAY,
      start_time: row.start_time?.slice(0, 5) || '',
      end_time: row.end_time?.slice(0, 5) || '',
      break_minutes: row.break_minutes != null ? String(row.break_minutes) : '0',
      notes: row.notes || '',
    })
    setShowModal(true)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    if (!form.employee_name.trim() || !form.work_date || !form.start_time || !form.end_time) return
    setSaving(true)
    const hours = calcHours(form.start_time, form.end_time, form.break_minutes)
    const payload = {
      employee_name: form.employee_name.trim(),
      work_date: form.work_date,
      start_time: form.start_time,
      end_time: form.end_time,
      break_minutes: parseInt(form.break_minutes) || 0,
      hours_total: hours ? parseFloat(hours) : null,
      notes: form.notes.trim() || null,
    }
    if (editing) await supabase.from('work_time_logs').update(payload).eq('id', editing)
    else await supabase.from('work_time_logs').insert(payload)
    setSaving(false)
    setShowModal(false)
    setEditing(null)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko työaikakirjaus?')) return
    await supabase.from('work_time_logs').delete().eq('id', id)
    fetchData()
  }

  const monthHours = rows.filter(r => r.work_date?.slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((s, r) => s + (r.hours_total || 0), 0)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Uusi kirjaus</button>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card"><div className="stat-label">Työtunnit tänä kuukautena</div><div className="stat-value gold">{monthHours.toFixed(1)} h</div></div>
        <div className="stat-card"><div className="stat-label">Kirjauksia yhteensä</div><div className="stat-value">{rows.length}</div></div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Päivä</th>
              {isAdmin && <th>Henkilö</th>}
              <th>Alkaa</th>
              <th>Loppuu</th>
              <th>Tauko</th>
              <th>Tunnit</th>
              <th>Muistiinpanot</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 8 : 7} className="table-empty">Ladataan...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={isAdmin ? 8 : 7} className="table-empty">Ei kirjauksia.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: '.78rem' }}>{r.work_date ? new Date(r.work_date).toLocaleDateString('fi-FI') : '—'}</td>
                {isAdmin && <td style={{ fontWeight: 600 }}>{r.employee_name}</td>}
                <td>{r.start_time?.slice(0, 5) || '—'}</td>
                <td>{r.end_time?.slice(0, 5) || '—'}</td>
                <td style={{ color: 'var(--text3)' }}>{r.break_minutes ? r.break_minutes + ' min' : '—'}</td>
                <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{r.hours_total != null ? r.hours_total + ' h' : '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 160 }}>{r.notes || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><Edit2 size={13} /></button>
                    {(isAdmin || r.employee_name === myName) && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Muokkaa kirjausta' : 'Uusi työaikakirjaus'} onClose={() => setShowModal(false)} footer={
          <>
            <VoiceMicButton label="Puhekirjaus" onResult={text => {
              const parsed = parseVoiceWorkTime(text)
              setForm(f => ({ ...f, ...parsed }))
            }} />
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Tallennetaan...' : 'Tallenna'}</button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Henkilö</label>
              <input className="input-field" name="employee_name" value={form.employee_name} onChange={handleChange}
                readOnly={!isAdmin} style={!isAdmin ? { background: 'var(--bg3)' } : {}} />
            </div>
            <div className="input-group">
              <label className="input-label">Päivämäärä</label>
              <input className="input-field" name="work_date" type="date" value={form.work_date} onChange={handleChange} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Alkaa</label>
                <input className="input-field" name="start_time" type="time" value={form.start_time} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Loppuu</label>
                <input className="input-field" name="end_time" type="time" value={form.end_time} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Tauko (min)</label>
              <input className="input-field" name="break_minutes" type="number" min="0" placeholder="0" value={form.break_minutes} onChange={handleChange} />
            </div>
            {form.start_time && form.end_time && (
              <div style={{ fontSize: '.83rem', color: 'var(--violet)', fontWeight: 700, padding: '.5rem .75rem', background: 'var(--violet-subtle)', borderRadius: 6 }}>
                Työtunteja: {calcHours(form.start_time, form.end_time, form.break_minutes) ?? '—'} h
              </div>
            )}
            <div className="input-group">
              <label className="input-label">Muistiinpanot</label>
              <textarea className="input-field" name="notes" rows={2} value={form.notes} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Timelog() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'hallitus'
  const myName = profile
    ? (`${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || '')
    : ''

  const [tab, setTab] = useState('tyoaika')

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Työaika / Ajokirjaukset</h1>
          <p className="page-subtitle">Kirjaa työtunnit ja ajomatkat</p>
        </div>
      </div>

      <div className="sub-tabs" style={{ marginBottom: '1.25rem' }}>
        <button className={`sub-tab${tab === 'tyoaika' ? ' active' : ''}`} onClick={() => setTab('tyoaika')}>
          Työaikakirjaus
        </button>
        <button className={`sub-tab${tab === 'ajo' ? ' active' : ''}`} onClick={() => setTab('ajo')}>
          Ajokirjaus
        </button>
      </div>

      {tab === 'tyoaika'
        ? <WorkTimeTab isAdmin={isAdmin} myName={myName} />
        : <AjokirjausTab isAdmin={isAdmin} myName={myName} />
      }
    </div>
  )
}
