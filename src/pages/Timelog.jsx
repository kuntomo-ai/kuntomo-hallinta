import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'

const empty = { driver_name: '', from_location: '', to_location: '', distance_km: '', odometer_before: '', odometer_after: '', notes: '' }

export default function Timelog() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ today: 0, month: 0, monthCount: 0 })

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    function onVoiceTimelog(e) {
      const name = profile?.full_name || profile?.email || ''
      setEditing(null)
      setForm({ ...empty, driver_name: name, ...e.detail })
      setShowModal(true)
    }
    window.addEventListener('voice-timelog', onVoiceTimelog)
    return () => window.removeEventListener('voice-timelog', onVoiceTimelog)
  }, [profile])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('drive_logs').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    const today = new Date().toISOString().slice(0, 10)
    const monthStart = new Date().toISOString().slice(0, 7)
    const todayKm = (data || []).filter(r => r.created_at?.slice(0, 10) === today).reduce((s, r) => s + (r.distance_km || 0), 0)
    const monthRows = (data || []).filter(r => r.created_at?.slice(0, 7) === monthStart)
    const monthKm = monthRows.reduce((s, r) => s + (r.distance_km || 0), 0)
    setStats({ today: todayKm, month: monthKm, monthCount: monthRows.length })
    setLoading(false)
  }

  function openNew() {
    const name = profile?.full_name || profile?.email || ''
    setEditing(null)
    setForm({ ...empty, driver_name: name })
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
      const updated = { ...f, [name]: value }
      if (name === 'odometer_before' || name === 'distance_km') {
        const before = parseFloat(updated.odometer_before)
        const dist = parseFloat(updated.distance_km)
        if (!isNaN(before) && !isNaN(dist)) updated.odometer_after = (before + dist).toFixed(1)
      }
      return updated
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
    if (editing) {
      await supabase.from('drive_logs').update(payload).eq('id', editing)
    } else {
      await supabase.from('drive_logs').insert(payload)
    }
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
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Ajokirjaukset</h1>
          <p className="page-subtitle">Kirjaa ja seuraa ajomatkoja</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> Uusi kirjaus
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Ajettu tänään</div>
          <div className="stat-value">{stats.today.toFixed(1)} km</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tällä kuulla</div>
          <div className="stat-value">{stats.month.toFixed(1)} km</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kirjauksia tällä kuulla</div>
          <div className="stat-value">{stats.monthCount}</div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pvm</th>
              <th>Kuljettaja</th>
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
              <tr><td colSpan={9} className="table-empty">Ladataan...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="table-empty">Ei ajokirjauksia.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: '.78rem' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</td>
                <td style={{ fontWeight: 600 }}>{r.driver_name}</td>
                <td>{r.from_location}</td>
                <td>{r.to_location}</td>
                <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{r.distance_km != null ? r.distance_km + ' km' : '—'}</td>
                <td style={{ color: 'var(--text3)' }}>{r.odometer_before != null ? r.odometer_before : '—'}</td>
                <td style={{ color: 'var(--text3)' }}>{r.odometer_after != null ? r.odometer_after : '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 160 }}>{r.notes || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><Edit2 size={13} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
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
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Kuljettaja</label>
              <input className="input-field" name="driver_name" placeholder="Etunimi Sukunimi" value={form.driver_name} onChange={handleChange} />
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
              <input className="input-field" name="odometer_after" type="number" step="0.1" placeholder="km" value={form.odometer_after} onChange={handleChange} style={{ background: 'var(--bg3)' }} readOnly />
            </div>
            <div className="input-group">
              <label className="input-label">Muistiinpanot</label>
              <textarea className="input-field" name="notes" rows={2} value={form.notes} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
