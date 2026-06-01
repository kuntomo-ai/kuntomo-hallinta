import { useEffect, useState } from 'react'
import { Search, Edit2, Wrench } from 'lucide-react'
import { supabaseAdmin } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'

const LOCATIONS = ['Kempele MIEHET', 'Kempele NAISET', 'Etu-Lyötty MIEHET', 'Etu-Lyötty NAISET']
const KEY_OPTIONS = ['kyllä', 'ei', '1 avain']
const YES_NO = ['kyllä', 'ei']

function statusBadge(val) {
  if (!val) return null
  const v = val.toLowerCase()
  if (v === 'kyllä') return <span className="badge badge-green">kyllä</span>
  if (v === 'ei') return <span className="badge badge-red">ei</span>
  return <span className="badge badge-yellow">{val}</span>
}

export default function Kaapit() {
  const { profile, isAdmin, role } = useAuth()
  const canService = isAdmin || role === 'respa' || role === 'huolto'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [location, setLocation] = useState(LOCATIONS[0])
  const [search, setSearch] = useState('')

  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  const [serviceHistory, setServiceHistory] = useState([])
  const [serviceRequest, setServiceRequest] = useState(false)
  const [serviceNote, setServiceNote] = useState('')
  const [savingService, setSavingService] = useState(false)
  const [serviceError, setServiceError] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabaseAdmin.from('lockers').select('*').order('location').order('locker_number')
    setRows(data || [])
    setLoading(false)
  }

  async function fetchServiceHistory(lockerId) {
    const { data } = await supabaseAdmin.from('locker_service_history')
      .select('*').eq('locker_id', lockerId).order('ilmoitettu_at', { ascending: false })
    setServiceHistory(data || [])
  }

  function openEdit(r) {
    setEditRow(r)
    setEditForm({
      two_keys: r.two_keys || 'kyllä',
      lock_works: r.lock_works || 'kyllä',
      has_keyring: r.has_keyring || 'kyllä',
      notes: r.notes || '',
    })
    setServiceRequest(false)
    setServiceNote('')
    setServiceError('')
    fetchServiceHistory(r.id)
  }

  async function handleSave() {
    if (!editRow) return
    setSaving(true)
    await supabaseAdmin.from('lockers').update({
      two_keys: editForm.two_keys,
      lock_works: editForm.lock_works,
      has_keyring: editForm.has_keyring,
      notes: editForm.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editRow.id)
    setSaving(false)
    setEditRow(null)
    await fetchData()
  }

  async function submitServiceRequest() {
    if (!serviceNote.trim() || !editRow) return
    setSavingService(true)
    setServiceError('')
    const myName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : profile?.email || 'Tuntematon'
    const lockerLabel = `Pukukaappi ${editRow.location} #${editRow.locker_number}`

    await supabaseAdmin.from('locker_service_history').insert({
      locker_id: editRow.id,
      kuvaus: serviceNote.trim(),
      ilmoitettu_by: myName,
      tehty: false,
    })

    await supabaseAdmin.from('lockers').update({ service_requested: true }).eq('id', editRow.id)

    const taskBase = {
      title: `Kaappihuolto: ${lockerLabel}`,
      description: serviceNote.trim(),
      status: 'todo',
      priority: 'high',
      created_by: myName || null,
    }
    await Promise.all([
      supabaseAdmin.from('tasks').insert({ ...taskBase, assigned_to: 'huolto' }),
      supabaseAdmin.from('tasks').insert({ ...taskBase, assigned_to: 'admin' }),
      supabaseAdmin.from('tasks').insert({ ...taskBase, assigned_to: 'respa' }),
    ])

    const msgBase = {
      content: `🔧 Huoltopyyntö — ${lockerLabel}: ${serviceNote.trim()}`,
      sender_name: myName,
      sender_id: profile?.id || null,
      recipient_type: 'role',
    }
    await Promise.all([
      supabaseAdmin.from('channel_messages').insert({ ...msgBase, recipient_role: 'huolto' }),
      supabaseAdmin.from('channel_messages').insert({ ...msgBase, recipient_role: 'admin' }),
      supabaseAdmin.from('channel_messages').insert({ ...msgBase, recipient_role: 'respa' }),
    ])

    setServiceRequest(false)
    setServiceNote('')
    await fetchServiceHistory(editRow.id)
    fetchData()
    setSavingService(false)
  }

  async function markServiceDone(historyId) {
    const myName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : profile?.email || 'Tuntematon'
    await supabaseAdmin.from('locker_service_history').update({
      tehty: true,
      tehty_at: new Date().toISOString(),
      tehty_by: myName,
    }).eq('id', historyId)

    const { data: remaining } = await supabaseAdmin.from('locker_service_history')
      .select('id').eq('locker_id', editRow.id).eq('tehty', false)
    if (!remaining || remaining.length === 0) {
      await supabaseAdmin.from('lockers').update({ service_requested: false }).eq('id', editRow.id)
    }
    fetchServiceHistory(editRow.id)
    fetchData()
  }

  async function deleteServiceHistory(historyId) {
    if (!confirm('Poistetaanko huoltohistoriamerkintä?')) return
    await supabaseAdmin.from('locker_service_history').delete().eq('id', historyId)
    fetchServiceHistory(editRow.id)
  }

  const locationRows = rows.filter(r => r.location === location)
  const filtered = locationRows.filter(r =>
    !search || String(r.locker_number).includes(search) || r.notes?.toLowerCase().includes(search.toLowerCase())
  )

  const issues = locationRows.filter(r =>
    r.lock_works === 'ei' || r.two_keys === 'ei' || r.two_keys === '1 avain' || r.has_keyring === 'ei'
  ).length
  const lockBroken = locationRows.filter(r => r.lock_works === 'ei').length
  const missingKeys = locationRows.filter(r => r.two_keys !== 'kyllä').length
  const noKeyring = locationRows.filter(r => r.has_keyring === 'ei').length
  const serviceCount = locationRows.filter(r => r.service_requested).length

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Pukukaapit</h1>
          <p className="page-subtitle">Pukukaappien tiedot ja kunnossapito</p>
        </div>
      </div>

      <div className="sub-tabs" style={{ marginBottom: '1.25rem' }}>
        {LOCATIONS.map(loc => (
          <button key={loc} className={`sub-tab${location === loc ? ' active' : ''}`}
            onClick={() => { setLocation(loc); setSearch('') }}>
            {loc}
          </button>
        ))}
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', marginBottom: '1.25rem' }}>
        <div className="stat-card">
          <div className="stat-label">Kaappeja yhteensä</div>
          <div className="stat-value">{locationRows.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ongelmakaappeja</div>
          <div className="stat-value" style={{ color: issues > 0 ? 'var(--red)' : undefined }}>{issues}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Lukko rikki</div>
          <div className="stat-value" style={{ color: lockBroken > 0 ? 'var(--red)' : undefined }}>{lockBroken}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avaimia puuttuu</div>
          <div className="stat-value" style={{ color: missingKeys > 0 ? 'var(--orange)' : undefined }}>{missingKeys}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ei avaimenperää</div>
          <div className="stat-value" style={{ color: noKeyring > 0 ? 'var(--orange)' : undefined }}>{noKeyring}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avoinna huolto</div>
          <div className="stat-value" style={{ color: serviceCount > 0 ? 'var(--red)' : undefined }}>{serviceCount}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <div className="search-wrap">
          <Search size={15} />
          <input className="search-input" placeholder="Hae numerolla tai muistiinpanolla..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kaapin nro</th>
              <th>Kaksi avainta</th>
              <th>Lukko toimii</th>
              <th>Avaimenperä</th>
              <th>Muistiinpanot</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">Ei kaappeja.</td></tr>
            ) : filtered.map(r => {
              const hasIssue = r.lock_works === 'ei' || r.two_keys !== 'kyllä' || r.has_keyring === 'ei'
              return (
                <tr key={r.id} style={hasIssue ? { background: 'rgba(239,68,68,.04)' } : {}}>
                  <td style={{ fontWeight: 700, fontSize: '1rem' }}>
                    {r.locker_number}
                    {r.service_requested && <span style={{ marginLeft: '.4rem', fontSize: '.65rem', background: '#FEE2E2', color: 'var(--red)', fontWeight: 700, padding: '.1rem .4rem', borderRadius: 4 }}>HUOLTO</span>}
                  </td>
                  <td>{statusBadge(r.two_keys)}</td>
                  <td>{statusBadge(r.lock_works)}</td>
                  <td>{statusBadge(r.has_keyring)}</td>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 200 }}>{r.notes || '—'}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><Edit2 size={13} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editRow && (
        <Modal
          title={`${editRow.location} — kaappi ${editRow.locker_number}`}
          onClose={() => setEditRow(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditRow(null)}>Peruuta</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Tallennetaan...' : 'Tallenna'}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Kaksi avainta</label>
              <select className="input-field" value={editForm.two_keys} onChange={e => setEditForm(f => ({ ...f, two_keys: e.target.value }))}>
                {KEY_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Lukko toimii</label>
              <select className="input-field" value={editForm.lock_works} onChange={e => setEditForm(f => ({ ...f, lock_works: e.target.value }))}>
                {YES_NO.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Avaimenperä</label>
              <select className="input-field" value={editForm.has_keyring} onChange={e => setEditForm(f => ({ ...f, has_keyring: e.target.value }))}>
                {YES_NO.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Muistiinpanot</label>
              <textarea className="input-field" rows={2} value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>

            {/* Huoltohistoria */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.1rem', marginTop: '.25rem' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', marginBottom: '.85rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <Wrench size={15} style={{ color: 'var(--violet)' }} /> Huoltohistoria
              </div>

              {serviceHistory.length === 0 ? (
                <p style={{ color: 'var(--text3)', fontSize: '.82rem', marginBottom: '.85rem' }}>Ei huoltohistoriaa.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginBottom: '1rem', maxHeight: 240, overflowY: 'auto' }}>
                  {serviceHistory.map(h => (
                    <div key={h.id} style={{
                      padding: '.65rem .9rem',
                      background: h.tehty ? 'var(--bg2)' : '#FFF3F3',
                      border: `1px solid ${h.tehty ? 'var(--border)' : '#FECACA'}`,
                      borderRadius: 'var(--radius)',
                      fontSize: '.82rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, marginBottom: '.2rem' }}>{h.kuvaus}</div>
                          <div style={{ color: 'var(--text3)', fontSize: '.75rem' }}>
                            Ilmoitettu {new Date(h.ilmoitettu_at).toLocaleDateString('fi-FI')} · {h.ilmoitettu_by || '—'}
                          </div>
                          {h.tehty && (
                            <div style={{ color: 'var(--green)', fontSize: '.75rem', marginTop: '.15rem', fontWeight: 600 }}>
                              ✓ Tehty {new Date(h.tehty_at).toLocaleDateString('fi-FI')} · {h.tehty_by}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '.3rem', flexShrink: 0 }}>
                          {!h.tehty
                            ? <span style={{ fontSize: '.68rem', color: 'var(--red)', fontWeight: 700, background: '#FEE2E2', padding: '.15rem .45rem', borderRadius: 4 }}>AVOINNA</span>
                            : <span style={{ fontSize: '.68rem', color: 'var(--green)', fontWeight: 700, background: '#D1FAE5', padding: '.15rem .45rem', borderRadius: 4 }}>TEHTY</span>
                          }
                          {canService && !h.tehty && (
                            <button className="btn btn-sm"
                              style={{ background: 'var(--green)', color: 'white', border: 'none', fontSize: '.72rem', padding: '.25rem .55rem', borderRadius: 'var(--radius)', cursor: 'pointer' }}
                              onClick={() => markServiceDone(h.id)}>
                              Kuittaa
                            </button>
                          )}
                          {isAdmin && (
                            <button className="btn btn-sm"
                              style={{ background: 'transparent', color: 'var(--red)', border: '1px solid #FECACA', fontSize: '.72rem', padding: '.25rem .55rem', borderRadius: 'var(--radius)', cursor: 'pointer' }}
                              onClick={() => deleteServiceHistory(h.id)}>
                              Poista
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.85rem 1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.6rem', cursor: 'pointer', fontSize: '.87rem', fontWeight: serviceRequest ? 700 : 400, color: serviceRequest ? 'var(--red)' : 'var(--text2)', userSelect: 'none' }}>
                  <input type="radio" checked={serviceRequest} onChange={() => setServiceRequest(v => !v)}
                    style={{ accentColor: 'var(--red)', cursor: 'pointer', width: 16, height: 16 }} />
                  Tilaa huolto
                </label>
                {serviceRequest && (
                  <div style={{ marginTop: '.7rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    <textarea className="input-field" rows={3} placeholder="Kuvaus huoltotarpeesta..."
                      value={serviceNote} onChange={e => setServiceNote(e.target.value)}
                      style={{ resize: 'vertical', fontSize: '.85rem' }} autoFocus />
                    <div style={{ fontSize: '.72rem', color: 'var(--text3)' }}>
                      Huoltopyyntö luo kiireellisen tehtävän Huolto-tiimille.
                    </div>
                    {serviceError && (
                      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '.5rem .75rem', fontSize: '.78rem', color: 'var(--red)' }}>
                        ⚠️ {serviceError}
                      </div>
                    )}
                    <button className="btn btn-primary" onClick={submitServiceRequest}
                      disabled={savingService || !serviceNote.trim()}
                      style={{ alignSelf: 'flex-end', background: 'var(--red)', borderColor: 'var(--red)' }}>
                      {savingService ? 'Lähetetään...' : 'Lähetä huoltopyyntö'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
