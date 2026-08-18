import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'
import EmployeesNav from '../components/EmployeesNav'

const ROLES = ['myynti', 'terapia_valmennus', 'huolto', 'sport', 'respa', 'hallitus', 'admin', 'salivastaava_kempele', 'salivastaava_etu_lyotty']
// Vain nämä ovat sallittuja arvoja profiles.role (app_role enum) -sarakkeessa.
// salivastaava_xxx elää vain profiles.roles-taulukossa.
const ENUM_ROLES = new Set(['myynti', 'terapia_valmennus', 'huolto', 'sport', 'respa', 'hallitus', 'admin'])
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
  const [editingAuthUid, setEditingAuthUid] = useState(null)
  const [editingPrevStatus, setEditingPrevStatus] = useState('active')
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [anniversaryBanners, setAnniversaryBanners] = useState([])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    // Fetch both profiles (all system users) and employees (HR data)
    const [profRes, empRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').order('first_name'),
      supabaseAdmin.from('employees').select('*'),
    ])
    const profiles = profRes.data || []
    const employees = empRes.data || []

    // Build email→employees map for fast lookup
    const empByEmail = {}
    employees.forEach(e => { if (e.email) empByEmail[e.email.toLowerCase()] = e })

    // Build a roles array for a row: prefer profiles.roles[], fall back to
    // splitting the comma-separated employees.role string for legacy data.
    const rolesFor = (p, emp) => {
      if (Array.isArray(p?.roles) && p.roles.length) return p.roles
      const src = p?.role || emp?.role || ''
      return src ? String(src).split(',').map(r => r.trim()).filter(Boolean) : []
    }

    // Merge: every profile gets shown, supplemented with employees HR data if it exists
    const merged = profiles.map(p => {
      const emp = empByEmail[p.email?.toLowerCase()] || {}
      const rolesArr = rolesFor(p, emp)
      return {
        // Identity from profile
        profile_id: p.id,
        first_name: p.first_name || emp.first_name || '',
        last_name: p.last_name || emp.last_name || '',
        email: p.email || emp.email || '',
        role: rolesArr.join(', '),
        roles: rolesArr,
        // HR data from employees (may be empty)
        employee_id: emp.id || null,
        title: emp.title || '',
        employment_type: emp.employment_type || '',
        employment_start: emp.employment_start || '',
        status: emp.status || 'active',
        key_management: emp.key_management || '',
        notes: emp.notes || '',
        created_at: emp.created_at || p.created_at,
      }
    })

    // Also show employees that have no matching profile (legacy records)
    employees.forEach(e => {
      if (!e.email || !profiles.find(p => p.email?.toLowerCase() === e.email?.toLowerCase())) {
        const rolesArr = rolesFor(null, e)
        merged.push({
          profile_id: null,
          employee_id: e.id,
          first_name: e.first_name || '',
          last_name: e.last_name || '',
          email: e.email || '',
          role: rolesArr.join(', '),
          roles: rolesArr,
          title: e.title || '',
          employment_type: e.employment_type || '',
          employment_start: e.employment_start || '',
          status: e.status || 'active',
          key_management: e.key_management || '',
          notes: e.notes || '',
          created_at: e.created_at,
        })
      }
    })

    setRows(merged)
    if (isAdmin) {
      const banners = merged.filter(e => {
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
    // editing = employee_id (null if person has no employees record yet)
    setEditing(row.employee_id || null)
    setEditingAuthUid(row.profile_id || null)
    setEditingPrevStatus(row.status || 'active')
    setForm({
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      email: row.email || '',
      roles: Array.isArray(row.roles) && row.roles.length
        ? row.roles
        : (row.role ? String(row.role).split(',').map(r => r.trim()).filter(Boolean) : []),
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
    setSaveError('')
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      role: form.roles.join(', ') || null,
      title: form.title.trim() || null,
      employment_type: form.employment_type || null,
      employment_start: form.employment_start || null,
      status: form.status,
      key_management: form.key_management.trim() || null,
      notes: form.notes.trim() || null,
    }
    try {
      if (editing) {
        // Update existing employees row
        const { error } = await supabaseAdmin.from('employees').update(payload).eq('id', editing)
        if (error) throw error

        // Sync name/role to matching profile if exists
        if (payload.email) {
          const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('email', payload.email).maybeSingle()
          if (prof) {
            await supabaseAdmin.from('profiles').update({
              first_name: payload.first_name,
              last_name: payload.last_name,
              role: form.roles.find(r => ENUM_ROLES.has(r)) || null,  // primary role (app_role enum — single value)
              roles: form.roles,            // full multi-role list (text[])
            }).eq('id', prof.id)
          }
        }

        // Status muuttui active↔inactive → aseta/vapauta ban auth-käyttäjälle
        if (editingAuthUid && form.status !== editingPrevStatus) {
          if (form.status === 'inactive') {
            await supabaseAdmin.auth.admin.updateUserById(editingAuthUid, { ban_duration: '876000h' })
          } else if (editingPrevStatus === 'inactive') {
            await supabaseAdmin.auth.admin.updateUserById(editingAuthUid, { ban_duration: 'none' })
          }
        }
      } else {
        // New person — insert employees row
        const { error } = await supabaseAdmin.from('employees').insert(payload)
        if (error) throw error

        if (form.email.trim()) {
          // Create auth user + profile
          const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email: form.email.trim(),
            email_confirm: true,
            user_metadata: { first_name: payload.first_name, last_name: payload.last_name },
          })
          if (authErr) throw new Error(`Käyttäjätunnuksen luonti epäonnistui: ${authErr.message}`)

          const uid = authData?.user?.id
          if (uid) {
            // Upsert profile
            await supabaseAdmin.from('profiles').upsert({
              id: uid,
              first_name: payload.first_name,
              last_name: payload.last_name,
              email: form.email.trim(),
              role: form.roles.find(r => ENUM_ROLES.has(r)) || null,
              roles: form.roles,
            })

            // Send password reset so user can set their own password
            await supabaseAdmin.auth.admin.generateLink({
              type: 'recovery',
              email: form.email.trim(),
            }).catch(() => {})
          }
        }
      }
      setShowModal(false)
      setEditing(null)
      setForm(empty)
      fetchData()
    } catch (err) {
      setSaveError(err?.message || 'Tallennus epäonnistui')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    const name = `${row.first_name} ${row.last_name}`.trim()
    if (!confirm(`Poistetaanko ${name} kokonaan järjestelmästä?\n\nTämä poistaa henkilön HR-tiedot, profiilin ja käyttäjätunnuksen.`)) return
    setDeleteError('')
    setSaving(true)
    try {
      const uid = row.profile_id

      // 1. Null out employee_id in all referencing tables (avoids FK constraint on auth user delete)
      if (uid) {
        await Promise.all([
          supabaseAdmin.from('terapiamyynti').update({ employee_id: null }).eq('employee_id', uid),
          supabaseAdmin.from('valmennusmyynti').update({ employee_id: null }).eq('employee_id', uid),
          supabaseAdmin.from('jasenmyynti').update({ employee_id: null }).eq('employee_id', uid),
          supabaseAdmin.from('work_logs').update({ employee_id: null }).eq('employee_id', uid),
          supabaseAdmin.from('work_time_logs').update({ employee_id: null }).eq('employee_id', uid),
          supabaseAdmin.from('drive_logs').update({ driver_id: null }).eq('driver_id', uid),
        ])
      }

      // 2. Delete employees HR record
      if (row.employee_id) {
        const { error: empErr } = await supabaseAdmin.from('employees').delete().eq('id', row.employee_id)
        if (empErr) throw new Error(`HR-tietojen poisto epäonnistui: ${empErr.message}`)
      }

      // 3. Delete profile row manually before auth delete
      if (uid) {
        await supabaseAdmin.from('profiles').delete().eq('id', uid)
      }

      // 4. Delete auth user — if blocked by DB constraints, ban instead (same effect)
      if (uid) {
        const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(uid)
        if (authErr) {
          // Fallback: ban user permanently so they can't log in
          await supabaseAdmin.auth.admin.updateUserById(uid, {
            ban_duration: '876000h', // 100 years
            email: `deleted_${Date.now()}@poistettu.invalid`,
          })
        }
      }
    } catch (err) {
      setDeleteError(err.message)
      setSaving(false)
      fetchData()
      return
    }
    setSaving(false)
    fetchData()
  }

  const filtered = rows.filter(r => {
    const full = `${r.first_name} ${r.last_name}`.toLowerCase()
    return !search || full.includes(search.toLowerCase()) || r.email?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div>
      <EmployeesNav />
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

      {deleteError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '.75rem 1.25rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--red)', fontSize: '.85rem' }}>⚠️ {deleteError}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '1rem' }} onClick={() => setDeleteError('')}>✕</button>
        </div>
      )}

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
              const roleList = Array.isArray(r.roles) && r.roles.length
                ? r.roles
                : (r.role ? r.role.split(',').map(s => s.trim()).filter(Boolean) : [])
              return (
                <tr key={r.employee_id || r.profile_id}>
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
                        {(r.employee_id || r.profile_id) && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r)}>Poista</button>}
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
        <Modal title={editing ? 'Muokkaa työntekijää' : 'Lisää työntekijä'} onClose={() => { setShowModal(false); setSaveError('') }} wide footer={
          <>
            {saveError && <span style={{ color: 'var(--red)', fontSize: '.82rem', flex: 1 }}>{saveError}</span>}
            <button className="btn btn-ghost" onClick={() => { setShowModal(false); setSaveError('') }}>Peruuta</button>
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
