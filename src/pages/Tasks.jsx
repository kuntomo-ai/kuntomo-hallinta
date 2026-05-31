import { useEffect, useState } from 'react'
import { Plus, CheckCircle, Trash2 } from 'lucide-react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'

const ROLES = ['myynti', 'terapia_valmennus', 'huolto', 'sport', 'respa', 'hallitus', 'admin']
const empty = { title: '', description: '', priority: 'medium', due_date: '', assigned_to: '' }

function statusBadge(status) {
  if (status === 'valmis') return <span className="badge badge-green">Valmis</span>
  if (status === 'myöhässä') return <span className="badge badge-red">Myöhässä</span>
  return <span className="badge badge-blue">Avoin</span>
}

function priorityBadge(priority) {
  if (priority === 'high') return <span className="badge badge-red">Kiireellinen</span>
  if (priority === 'low') return <span className="badge badge-gray">Matala</span>
  return <span className="badge badge-gray">Normaali</span>
}

function computeStatus(task) {
  if (task.completed || task.status === 'valmis' || task.status === 'done') return 'valmis'
  if (task.due_date && new Date(task.due_date) < new Date()) return 'myöhässä'
  return 'avoin'
}

export default function Tasks() {
  const { profile, isAdmin } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('kaikki')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [assignType, setAssignType] = useState('self')
  const [persons, setPersons] = useState([])
  const [selectedPerson, setSelectedPerson] = useState('')
  const [selectedRoles, setSelectedRoles] = useState([])

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    if (isAdmin) {
      supabaseAdmin.from('profiles').select('id, first_name, last_name').order('first_name')
        .then(({ data }) => setPersons(data || []))
    }
  }, [isAdmin])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabaseAdmin.from('tasks').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)

    let assignedTo = form.assigned_to.trim() || null
    if (isAdmin) {
      if (assignType === 'self') {
        assignedTo = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || profile?.email || null
      } else if (assignType === 'person') {
        assignedTo = selectedPerson || null
      } else if (assignType === 'role') {
        assignedTo = selectedRoles.length > 0 ? selectedRoles.join(', ') : null
      }
    }

    await supabaseAdmin.from('tasks').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      due_date: form.due_date || null,
      assigned_to: assignedTo || null,
      created_by: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || profile?.email || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm(empty)
    if (isAdmin) { setAssignType('self'); setSelectedPerson(''); setSelectedRoles([]) }
    fetchData()
  }

  async function markDone(id) {
    await supabaseAdmin.from('tasks').update({ completed: true, status: 'done' }).eq('id', id)
    fetchData()
  }

  async function deleteTask(id) {
    if (!confirm('Poistetaanko tehtävä?')) return
    await supabaseAdmin.from('tasks').delete().eq('id', id)
    fetchData()
  }

  const withStatus = rows.map(r => ({ ...r, computedStatus: computeStatus(r) }))
  const myEmail = profile?.email || ''
  const myName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
  const myRole = profile?.role || ''
  const filtered = withStatus.filter(r => {
    if (tab === 'avoimet') return r.computedStatus === 'avoin'
    if (tab === 'kiireelliset') return r.priority === 'high' && r.computedStatus !== 'valmis'
    if (tab === 'minun') {
      const at = r.assigned_to || ''
      const assignedRoles = at.split(',').map(s => s.trim())
      return at === myEmail || at === myName || at === profile?.full_name || (myRole && assignedRoles.includes(myRole))
    }
    return true
  })

  const openCount = withStatus.filter(r => r.computedStatus === 'avoin').length
  const urgentCount = withStatus.filter(r => r.priority === 'high' && r.computedStatus !== 'valmis').length

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Tehtävät</h1>
          <p className="page-subtitle">Hallitse ja seuraa tehtäviä</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setAssignType('self'); setSelectedPerson(''); setSelectedRoles([]); setShowModal(true) }}>
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
                  <div style={{ display: 'flex', gap: '.35rem' }}>
                    {r.computedStatus !== 'valmis' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => markDone(r.id)} title="Merkitse valmiiksi">
                        <CheckCircle size={14} />
                      </button>
                    )}
                    {(isAdmin || r.assigned_to === myName || r.assigned_to === myEmail || r.assigned_to === myRole) && (
                      <button className="btn btn-danger btn-sm" onClick={() => deleteTask(r.id)} title="Poista tehtävä">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
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
                  <option value="low">Matala</option>
                  <option value="medium">Normaali</option>
                  <option value="high">Kiireellinen</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Deadline</label>
                <input className="input-field" name="due_date" type="date" value={form.due_date} onChange={handleChange} />
              </div>
            </div>
            {isAdmin ? (
              <div className="input-group">
                <label className="input-label">Vastuuhenkilö</label>
                <div style={{ display: 'flex', gap: '1.25rem', marginTop: '.3rem', marginBottom: '.6rem' }}>
                  {[['self', 'Itselleni'], ['person', 'Toiselle henkilölle'], ['role', 'Roolille']].map(([v, l]) => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontSize: '.85rem', userSelect: 'none' }}>
                      <input type="radio" name="assignType" value={v}
                        checked={assignType === v}
                        onChange={() => setAssignType(v)}
                        style={{ accentColor: 'var(--violet)', cursor: 'pointer' }} />
                      {l}
                    </label>
                  ))}
                </div>
                {assignType === 'self' && (
                  <div style={{ fontSize: '.82rem', color: 'var(--text2)', padding: '.45rem .75rem', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    {myName || myEmail || '—'}
                  </div>
                )}
                {assignType === 'person' && (
                  <select className="input-field" value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)}>
                    <option value="">Valitse henkilö</option>
                    {persons.map(p => {
                      const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
                      return <option key={p.id} value={name}>{name}</option>
                    })}
                  </select>
                )}
                {assignType === 'role' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.3rem .75rem', padding: '.55rem .75rem', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    {ROLES.map(r => (
                      <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '.45rem', cursor: 'pointer', userSelect: 'none', fontSize: '.84rem' }}>
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(r)}
                          onChange={e => setSelectedRoles(prev =>
                            e.target.checked ? [...prev, r] : prev.filter(x => x !== r)
                          )}
                          style={{ accentColor: 'var(--violet)', cursor: 'pointer', width: 15, height: 15 }}
                        />
                        {r}
                      </label>
                    ))}
                    {selectedRoles.length === 0 && (
                      <span style={{ gridColumn: '1/-1', fontSize: '.75rem', color: 'var(--text3)', marginTop: '.15rem' }}>Valitse vähintään yksi rooli</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="input-group">
                <label className="input-label">Vastuuhenkilö</label>
                <input className="input-field" name="assigned_to" placeholder="Nimi tai sähköposti" value={form.assigned_to} onChange={handleChange} />
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
