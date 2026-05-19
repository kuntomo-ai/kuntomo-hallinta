import { useEffect, useState } from 'react'
import { Plus, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'

const empty = { title: '', description: '', priority: 'normal', due_date: '', assigned_to: '' }

function statusBadge(status) {
  if (status === 'valmis') return <span className="badge badge-green">Valmis</span>
  if (status === 'myöhässä') return <span className="badge badge-red">Myöhässä</span>
  return <span className="badge badge-blue">Avoin</span>
}

function priorityBadge(priority) {
  if (priority === 'kiireellinen') return <span className="badge badge-red">Kiireellinen</span>
  return <span className="badge badge-gray">Normaali</span>
}

function computeStatus(task) {
  if (task.status === 'valmis') return 'valmis'
  if (task.due_date && new Date(task.due_date) < new Date()) return 'myöhässä'
  return 'avoin'
}

export default function Tasks() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('kaikki')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    await supabase.from('tasks').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: 'avoin',
      priority: form.priority,
      due_date: form.due_date || null,
      assigned_to: form.assigned_to.trim() || null,
      created_by: profile?.full_name || profile?.email || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm(empty)
    fetchData()
  }

  async function markDone(id) {
    await supabase.from('tasks').update({ status: 'valmis' }).eq('id', id)
    fetchData()
  }

  const withStatus = rows.map(r => ({ ...r, computedStatus: computeStatus(r) }))
  const myEmail = profile?.email || ''
  const filtered = withStatus.filter(r => {
    if (tab === 'avoimet') return r.computedStatus === 'avoin'
    if (tab === 'kiireelliset') return r.priority === 'kiireellinen' && r.computedStatus !== 'valmis'
    if (tab === 'minun') return r.assigned_to === myEmail || r.assigned_to === profile?.full_name
    return true
  })

  const openCount = withStatus.filter(r => r.computedStatus === 'avoin').length
  const urgentCount = withStatus.filter(r => r.priority === 'kiireellinen' && r.computedStatus !== 'valmis').length

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Tehtävät</h1>
          <p className="page-subtitle">Hallitse ja seuraa tehtäviä</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setShowModal(true) }}>
          <Plus size={16} /> Uusi tehtävä
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', marginBottom: '1.25rem' }}>
        <div className="stat-card">
          <div className="stat-label">Avoimet</div>
          <div className="stat-value">{openCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kiireelliset</div>
          <div className="stat-value" style={{ color: urgentCount > 0 ? 'var(--red)' : undefined }}>{urgentCount}</div>
        </div>
      </div>

      <div className="sub-tabs">
        <button className={`sub-tab${tab === 'kaikki' ? ' active' : ''}`} onClick={() => setTab('kaikki')}>Kaikki</button>
        <button className={`sub-tab${tab === 'avoimet' ? ' active' : ''}`} onClick={() => setTab('avoimet')}>Avoimet</button>
        <button className={`sub-tab${tab === 'kiireelliset' ? ' active' : ''}`} onClick={() => setTab('kiireelliset')}>Kiireelliset</button>
        <button className={`sub-tab${tab === 'minun' ? ' active' : ''}`} onClick={() => setTab('minun')}>Tehtäväni</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Otsikko</th>
              <th>Prioriteetti</th>
              <th>Tila</th>
              <th>Deadline</th>
              <th>Vastuuhenkilö</th>
              <th>Luotu</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="table-empty">Ei tehtäviä.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.title}</div>
                  {r.description && <div style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: '.2rem' }}>{r.description}</div>}
                </td>
                <td>{priorityBadge(r.priority)}</td>
                <td>{statusBadge(r.computedStatus)}</td>
                <td style={{ color: r.computedStatus === 'myöhässä' ? 'var(--red)' : 'var(--text3)', fontSize: '.78rem' }}>
                  {r.due_date ? new Date(r.due_date).toLocaleDateString('fi-FI') : '—'}
                </td>
                <td style={{ fontSize: '.82rem' }}>{r.assigned_to || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</td>
                <td>
                  {r.computedStatus !== 'valmis' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => markDone(r.id)} title="Merkitse valmiiksi">
                      <CheckCircle size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Uusi tehtävä" onClose={() => setShowModal(false)} footer={
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
              <input className="input-field" name="title" placeholder="Tehtävän otsikko" value={form.title} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Kuvaus</label>
              <textarea className="input-field" name="description" rows={3} value={form.description} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Prioriteetti</label>
                <select className="input-field" name="priority" value={form.priority} onChange={handleChange}>
                  <option value="normal">Normaali</option>
                  <option value="kiireellinen">Kiireellinen</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Deadline</label>
                <input className="input-field" name="due_date" type="date" value={form.due_date} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Vastuuhenkilö</label>
              <input className="input-field" name="assigned_to" placeholder="Nimi tai sähköposti" value={form.assigned_to} onChange={handleChange} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
