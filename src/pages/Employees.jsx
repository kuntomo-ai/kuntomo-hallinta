import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'

const ROLES = ['myynti', 'terapia_valmennus', 'huolto', 'sport', 'respa', 'hallitus', 'admin']
const EMPLOYMENT_TYPES = ['Työsuhde', 'Yrittäjä', 'Tuntityöntekijä', 'Harjoittelija']
const STATUSES = ['active', 'inactive', 'vacation', 'sick_leave']
const STATUS_LABELS = { active: 'Aktiivinen', inactive: 'Ei aktiivinen', vacation: 'Lomalla', sick_leave: 'Sairasloma' }

const empty = {
  first_name: '', last_name: '', email: '', roles: [], title: '',
  employment_type: EMPLOYMENT_TYPES[0], employment_start: '', status: 'active',
  key_management: '', notes: ''
}

function roleBadge(role) {
  const map = { admin: 'badge-red', hallitus: 'badge-gold', myynti: 'badge-blue', terapia_valmennus: 'badge-green', huolto: 'badge-orange', sport: 'badge-blue', respa: 'badge-gray' }
  return <span key={role} className={`badge ${map[role] || 'badge-gray'}`}>{role}</span>
}

function statusBadge(s) {
  const map = { active: 'badge-green', inactive: 'badge-gray', vacation: 'badge-blue', sick_leave: 'badge-orange' }
  return <span className={`badge ${map[s] || 'badge-gray'}`}>{STATUS_LABELS[s] || s}</span>
}

function daysUntilAnniversary(dateStr, years) {
  if (!dateStr) return null
  const start = new Date(dateStr)
  const anniversary = new Date(start)
  anniversary.setFullYear(start.getFullYear() + years)
  const now = new Date()
  const diff = Math.ceil((anniversary - now) / (1000 * 60 * 60 * 24))
  return diff
}

export default function Employees() {
  const { isAdmin, isHallitus } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [anniversaryBanners, setAnniversaryBanners] = useState([])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('employees').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    if (isAdmin) {
      const banners = (data || []).filter(e => {
        const d = daysUntilAnniversary(e.employment_start, 10)
        return d !== null && d >= 0 && d <= 30
      })
      setAnniversaryBanners(banners)
    }
    setLoading(false)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function toggleRole(role) {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role]
    }))
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      email: row.email || '',
      roles: Array.isArray(row.role) ? row.role : (row.role ? row.role.split(',').map(r => r.trim()) : []),
      title: row.title || '',
      employment_type: row.employment_type || EMPLOYMENT_TYPES[0],
      employment_start: row.employment_start || '',
      status: row.status || 'active',
      key_management: row.key_management || '',
      notes: row.notes || '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.first_name.trim() || !form.last_name.trim()) return
    setSaving(true)
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      role: form.roles.join(', ') || null,
      title: form.title.trim() || null,
      employment_type: form.employment_type,
      employment_start: form.employment_start || null,
      status: form.status,
      key_management: form.key_management.trim() || null,
      notes: form.notes.trim() || null,
    }
    if (editing) {
      await supabase.from('employees').update(payload).eq('id', editing)
    } else {
      await supabase.from('employees').insert(payload)
      if (form.email.trim()) {
        await supabaseAdmin.auth.admin.inviteUserByEmail(form.email.trim())
      }
    }
    setSaving(false)
    setShowModal(false)
    setEditing(null)
    setForm(empty)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko työntekijä?')) return
    await supabase.from('employees').delete().eq('id', id)
    fetchData()
  }

  const filtered = rows.filter(r => {
    const full = `${r.first_name} ${r.last_name}`.toLowerCase()
    return full.includes(search.toLowerCase()) || r.email?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Henkilöstö</h1>
          <p className="page-subtitle">Hallitse työntekijätietoja</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(empty); setShowModal(true) }}>
            <Plus size={16} /> Lisää työntekijä
          </button>
        )}
      </div>

      {isAdmin && anniversaryBanners.length > 0 && anniversaryBanners.map(e => (
        <div key={e.id} style={{ background: 'var(--violet-subtle)', border: '1px solid var(--violet-border)', borderRadius: 'var(--radius)', padding: '.85rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🎉</span>
          <div>
            <strong>{e.first_name} {e.last_name}</strong> täyttää <strong>10 vuotta</strong> talossa {daysUntilAnniversary(e.employment_start, 10)} päivän päästä!
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <div className="search-wrap">
          <Search size={15} />
          <input className="search-input" placeholder="Hae nimellä tai emaililla..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nimi</th>
              <th>Rooli</th>
              <th>Tehtävä</th>
              <th>Työsuhde</th>
              <th>Aloituspäivä</th>
              <th>Tila</th>
              <th>Avainten hallinta</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 8 : 7} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={isAdmin ? 8 : 7} className="table-empty">Ei henkilöstöä.</td></tr>
            ) : filtered.map(r => {
              const roleList = Array.isArray(r.role) ? r.role : (r.role ? r.role.split(',').map(s => s.trim()) : [])
              return (
                <tr key={r.id}>
                  <td>
                    <div className="emp-name-cell">
                      <div className="emp-avatar">{(r.first_name?.[0] || '') + (r.last_name?.[0] || '')}</div>
                      <div>
                        <div className="emp-name">{r.first_name} {r.last_name}</div>
                        <div className="emp-email">{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><div style={{ display: 'flex', flexWrap: 'wrap', gap: '.25rem' }}>{roleList.map(role => roleBadge(role))}</div></td>
                  <td>{r.title || '—'}</td>
                  <td>{r.employment_type || '—'}</td>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.employment_start ? new Date(r.employment_start).toLocaleDateString('fi-FI') : '—'}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 160 }}>{r.key_management || '—'}</td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: '.4rem' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Muokkaa</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Poista</button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && isAdmin && (
        <Modal title={editing ? 'Muokkaa työntekijää' : 'Lisää työntekijä'} onClose={() => setShowModal(false)} wide footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Tallennetaan...' : editing ? 'Tallenna' : 'Lisää ja kutsu'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Etunimi</label>
                <input className="input-field" name="first_name" placeholder="Etunimi" value={form.first_name} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Sukunimi</label>
                <input className="input-field" name="last_name" placeholder="Sukunimi" value={form.last_name} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Sähköposti</label>
              <input className="input-field" name="email" type="email" placeholder="etunimi@kuntomo.fi" value={form.email} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Rooli (valitse kaikki sopivat)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '.25rem' }}>
                {ROLES.map(role => (
                  <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontSize: '.82rem', fontWeight: form.roles.includes(role) ? 600 : 400, color: form.roles.includes(role) ? 'var(--violet)' : 'var(--text2)' }}>
                    <input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} style={{ accentColor: 'var(--violet)' }} />
                    {role}
                  </label>
                ))}
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Titteli / Tehtävä</label>
              <input className="input-field" name="title" placeholder="Esim. Fysioterapeutti" value={form.title} onChange={handleChange} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Työsuhde</label>
                <select className="input-field" name="employment_type" value={form.employment_type} onChange={handleChange}>
                  {EMPLOYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Aloituspäivä</label>
                <input className="input-field" name="employment_start" type="date" value={form.employment_start} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Tila</label>
              <select className="input-field" name="status" value={form.status} onChange={handleChange}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Avainten hallinta (valinnainen)</label>
              <input className="input-field" name="key_management" placeholder="Esim. avain A1, parkkihalli..." value={form.key_management} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Muistiinpanot</label>
              <textarea className="input-field" name="notes" rows={3} value={form.notes} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
