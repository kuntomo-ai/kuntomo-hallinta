import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, Wrench, CheckCircle, QrCode, Copy, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'

const SIJAINNIT = ['Kaikki', 'linnakangas', 'Etu-Lyötty', 'Kempele']

const empty = { sijainti: '', category: '', name: '', model: '', serial_number: '', price: '', purchase_date: '', notes: '', device_number: '', ohjevideo_url: '' }

export default function Laiteluettelo() {
  const { profile, isAdmin, role } = useAuth()
  const canService = isAdmin || role === 'respa' || role === 'huolto'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSijainti, setFilterSijainti] = useState('Kaikki')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editingDeviceName, setEditingDeviceName] = useState('')
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [copiedUrl, setCopiedUrl] = useState(false)

  const [serviceHistory, setServiceHistory] = useState([])
  const [serviceRequest, setServiceRequest] = useState(false)
  const [serviceNote, setServiceNote] = useState('')
  const [savingService, setSavingService] = useState(false)
  const [serviceError, setServiceError] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabaseAdmin.from('laiteluettelo_items').select('*').order('sijainti').order('name')
    setRows(data || [])
    setLoading(false)
  }

  async function fetchServiceHistory(deviceId) {
    const { data } = await supabaseAdmin.from('laite_huoltohistoria')
      .select('*').eq('laite_id', deviceId).order('ilmoitettu_at', { ascending: false })
    setServiceHistory(data || [])
  }

  async function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    // Kun uusi laite ja sijainti vaihtuu: ehdota seuraavaa laitenumeroa
    if (name === 'sijainti' && !editing) {
      const base = value === 'Etu-Lyötty' ? 0 : value === 'Kempele' ? 100 : value === 'linnakangas' ? 200 : null
      if (base === null) return
      const { data } = await supabaseAdmin.from('laiteluettelo_items').select('device_number').eq('sijainti', value)
      const nums = (data || [])
        .map(r => parseInt(r.device_number, 10))
        .filter(n => !isNaN(n) && n > base && n < base + 100)
      const next = String((nums.length ? Math.max(...nums) : base) + 1).padStart(3, '0')
      setForm(f => ({ ...f, device_number: f.device_number || next }))
    }
  }

  function openEdit(row) {
    setSaveError('')
    setEditing(row.id)
    setEditingDeviceName(row.name)
    setForm({
      sijainti:      row.sijainti || '',
      category:      row.category || '',
      name:          row.name || '',
      model:         row.model || '',
      serial_number: row.serial_number || '',
      price:         row.price != null ? String(row.price) : '',
      purchase_date: row.purchase_date || '',
      notes:         row.notes || '',
      device_number: row.device_number || '',
      ohjevideo_url: row.ohjevideo_url || '',
    })
    setCopiedUrl(false)
    setServiceRequest(false)
    setServiceNote('')
    fetchServiceHistory(row.id)
    setShowModal(true)
  }

  function openNew() {
    setSaveError('')
    setEditing(null)
    setEditingDeviceName('')
    setForm(empty)
    setServiceHistory([])
    setServiceRequest(false)
    setServiceNote('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        sijainti:      form.sijainti.trim() || null,
        category:      form.category.trim() || null,
        name:          form.name.trim(),
        model:         form.model.trim() || null,
        serial_number: form.serial_number.trim() || null,
        price:         form.price !== '' ? parseFloat(form.price) : null,
        purchase_date: form.purchase_date.trim() || null,
        notes:         form.notes.trim() || null,
        device_number: form.device_number.trim() || null,
        ohjevideo_url: form.ohjevideo_url.trim() || null,
        updated_at:    new Date().toISOString(),
      }
      const { error } = editing
        ? await supabaseAdmin.from('laiteluettelo_items').update(payload).eq('id', editing)
        : await supabaseAdmin.from('laiteluettelo_items').insert(payload)
      if (error) {
        setSaveError(`Tallennus epäonnistui: ${error.message}`)
        return
      }
      setShowModal(false)
      setEditing(null)
      setForm(empty)
      fetchData()
    } catch (err) {
      setSaveError(`Odottamaton virhe: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko laite?')) return
    await supabaseAdmin.from('laiteluettelo_items').delete().eq('id', id)
    fetchData()
  }

  async function submitServiceRequest() {
    if (!serviceNote.trim() || !editing) return
    setSavingService(true)
    setServiceError('')
    const myName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : profile?.email || 'Tuntematon'

    await supabaseAdmin.from('laite_huoltohistoria').insert({
      laite_id: editing,
      kuvaus: serviceNote.trim(),
      ilmoitettu_by: myName,
      tehty: false,
    })

    await supabaseAdmin.from('laiteluettelo_items').update({ service_requested: true }).eq('id', editing)

    const taskBase = {
      title: `Laitehuolto: ${editingDeviceName}`,
      description: serviceNote.trim(),
      status: 'avoin',
      priority: 'high',
      due_date: null,
      created_by: myName || null,
    }
    const taskResults = await Promise.all([
      supabaseAdmin.from('tasks').insert({ ...taskBase, assigned_to: 'huolto' }),
      supabaseAdmin.from('tasks').insert({ ...taskBase, assigned_to: 'admin' }),
      supabaseAdmin.from('tasks').insert({ ...taskBase, assigned_to: 'respa' }),
    ])
    const taskErr = taskResults.find(r => r.error)
    if (taskErr) {
      setServiceError('Tehtävän luonti epäonnistui: ' + taskErr.error.message)
      setSavingService(false)
      return
    }

    const msgBase = {
      content: `🔧 Huoltopyyntö — ${editingDeviceName}: ${serviceNote.trim()}`,
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
    await fetchServiceHistory(editing)
    fetchData()
    setSavingService(false)
  }

  async function deleteServiceHistory(historyId) {
    if (!confirm('Poistetaanko huoltohistoriamerkintä?')) return
    await supabaseAdmin.from('laite_huoltohistoria').delete().eq('id', historyId)
    fetchServiceHistory(editing)
  }

  async function markServiceDone(historyId) {
    const myName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : profile?.email || 'Tuntematon'
    await supabaseAdmin.from('laite_huoltohistoria').update({
      tehty: true,
      tehty_at: new Date().toISOString(),
      tehty_by: myName,
    }).eq('id', historyId)

    const { data: remaining } = await supabaseAdmin.from('laite_huoltohistoria')
      .select('id').eq('laite_id', editing).eq('tehty', false)

    if (!remaining || remaining.length === 0) {
      await supabaseAdmin.from('laiteluettelo_items').update({ service_requested: false }).eq('id', editing)
    }

    fetchServiceHistory(editing)
    fetchData()
  }

  async function quickMarkServiceDone(deviceId, deviceName) {
    if (!confirm(`Kuitataanko huolto: ${deviceName}?`)) return
    const myName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : profile?.email || 'Tuntematon'
    const { data: openReqs } = await supabaseAdmin.from('laite_huoltohistoria')
      .select('id').eq('laite_id', deviceId).eq('tehty', false)
    for (const req of (openReqs || [])) {
      await supabaseAdmin.from('laite_huoltohistoria').update({
        tehty: true, tehty_at: new Date().toISOString(), tehty_by: myName,
      }).eq('id', req.id)
    }
    await supabaseAdmin.from('laiteluettelo_items').update({ service_requested: false }).eq('id', deviceId)
    fetchData()
  }

  const filtered = rows.filter(r => {
    const matchSearch = !search ||
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.category?.toLowerCase().includes(search.toLowerCase()) ||
      r.model?.toLowerCase().includes(search.toLowerCase()) ||
      r.serial_number?.toLowerCase().includes(search.toLowerCase())
    const matchSijainti = filterSijainti === 'Kaikki' || r.sijainti === filterSijainti
    return matchSearch && matchSijainti
  })

  const grouped = filtered.reduce((acc, r) => {
    const key = r.sijainti || 'Tuntematon'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  const serviceCount = filtered.filter(r => r.service_requested).length

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Laiteluettelo</h1>
          <p className="page-subtitle">Kuntosalin laitteet ja varusteet</p>
        </div>
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
          <Link to="/laiteluettelo/kaapit">
            <button className="btn btn-ghost">Pukukaapit</button>
          </Link>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openNew}>
              <Plus size={16} /> Uusi laite
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          {SIJAINNIT.map(s => (
            <button key={s} className={`btn btn-sm ${filterSijainti === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilterSijainti(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="search-wrap" style={{ marginLeft: 'auto' }}>
          <Search size={15} />
          <input className="search-input" placeholder="Hae nimellä, mallilla, sarjanumerolla..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: '.75rem', fontSize: '.82rem', display: 'flex', gap: '1rem' }}>
        <span style={{ color: 'var(--text3)' }}>{filtered.length} laitetta</span>
        {serviceCount > 0 && (
          <span style={{ color: 'var(--red)', fontWeight: 700 }}>
            🔴 {serviceCount} avoin huoltopyyntö{serviceCount !== 1 ? 'ä' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="table-wrap"><table><tbody><tr><td colSpan={8} className="table-empty">Ladataan...</td></tr></tbody></table></div>
      ) : filtered.length === 0 ? (
        <div className="table-wrap"><table><tbody><tr><td colSpan={8} className="table-empty">Ei laitteita.</td></tr></tbody></table></div>
      ) : (
        Object.entries(grouped).map(([sijainti, items]) => (
          <div key={sijainti} style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', marginBottom: '.75rem', color: 'var(--text1)', textTransform: 'capitalize' }}>
              {sijainti} <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: '.82rem' }}>({items.length} kpl)</span>
            </h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nro</th><th>Nimi</th><th>Kategoria</th><th>Malli</th><th>Sarjanumero</th>
                    <th>Hinta</th><th>Hankintapvm</th><th>Muistiinpanot</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(r => (
                    <tr key={r.id} style={r.service_requested ? { background: '#FFF3F3' } : {}}>
                      <td style={{ fontSize: '.75rem', color: 'var(--violet)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {r.device_number || '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {r.service_requested && <span style={{ color: 'var(--red)', marginRight: '.4rem' }}>🔴</span>}
                        {r.name}
                      </td>
                      <td>{r.category || '—'}</td>
                      <td>{r.model || '—'}</td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text3)' }}>{r.serial_number || '—'}</td>
                      <td>{r.price != null ? `${r.price.toLocaleString('fi-FI')} €` : '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{r.purchase_date || '—'}</td>
                      <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 160 }}>{r.notes || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '.4rem' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><Edit2 size={13} /></button>
                          {canService && r.service_requested && (
                            <button
                              className="btn btn-sm"
                              style={{ background: 'var(--green)', color: 'white', border: 'none', fontSize: '.72rem', padding: '.3rem .55rem', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.25rem' }}
                              onClick={() => quickMarkServiceDone(r.id, r.name)}
                              title="Kuittaa huolto">
                              <CheckCircle size={13} /> Kuittaa
                            </button>
                          )}
                          {isAdmin && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {showModal && (
        <Modal
          title={editing ? `Muokkaa: ${editingDeviceName}` : 'Uusi laite'}
          onClose={() => setShowModal(false)}
          wide
          footer={
            <>
              {saveError && (
                <div style={{ flex: 1, fontSize: '.78rem', color: 'var(--red)', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '.4rem .7rem' }}>
                  ⚠️ {saveError}
                </div>
              )}
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Tallennetaan...' : 'Tallenna'}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Laitenumero</label>
                <input className="input-field" name="device_number" placeholder="Esim. KNT-001" value={form.device_number} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Sijainti</label>
                <select className="input-field" name="sijainti" value={form.sijainti} onChange={handleChange}>
                  <option value="">Valitse...</option>
                  <option value="linnakangas">Linnakangas</option>
                  <option value="Etu-Lyötty">Etu-Lyötty</option>
                  <option value="Kempele">Kempele</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Kategoria</label>
                <input className="input-field" name="category" placeholder="Esim. cardio, painopakkalaite" value={form.category} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Nimi</label>
              <input className="input-field" name="name" placeholder="Laitteen nimi" value={form.name} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Malli</label>
              <input className="input-field" name="model" placeholder="Mallinimi tai -numero" value={form.model} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Sarjanumero</label>
              <input className="input-field" name="serial_number" placeholder="Sarjanumero" value={form.serial_number} onChange={handleChange} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Hinta (€)</label>
                <input className="input-field" name="price" type="number" step="0.01" min="0" placeholder="0.00" value={form.price} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Hankintapvm</label>
                <input className="input-field" name="purchase_date" placeholder="Esim. 2023-01-15" value={form.purchase_date} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Muistiinpanot</label>
              <textarea className="input-field" name="notes" rows={2} value={form.notes} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
            <div className="input-group">
              <label className="input-label">Ohjevideo URL</label>
              <input className="input-field" name="ohjevideo_url" type="text" placeholder="https://youtube.com/watch?v=..." value={form.ohjevideo_url} onChange={handleChange} />
            </div>

            {/* ── QR-koodi (only when editing) ────────────────────────────── */}
            {editing && (() => {
              const publicUrl = `${window.location.origin}/laite/${editing}`
              return (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.1rem', marginTop: '.25rem' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', marginBottom: '.85rem', display: 'flex', alignItems: 'center', gap: '.5rem', color: 'var(--text)' }}>
                    <QrCode size={15} style={{ color: 'var(--violet)' }} /> QR-koodi ja vikailmoituslinkki
                  </div>
                  <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flexShrink: 0, padding: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <QRCodeSVG value={publicUrl} size={112} />
                    </div>
                    <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
                      <div style={{ fontSize: '.75rem', color: 'var(--text3)' }}>
                        Tähän URL:iin QR-koodi ohjaa. Asiakas voi ilmoittaa vian kirjautumatta.
                      </div>
                      <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                        <code style={{
                          flex: 1, fontSize: '.72rem', background: 'var(--bg2)', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '.3rem .55rem', wordBreak: 'break-all', color: 'var(--text2)',
                        }}>{publicUrl}</code>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ flexShrink: 0, gap: '.25rem' }}
                          onClick={() => {
                            navigator.clipboard.writeText(publicUrl)
                            setCopiedUrl(true)
                            setTimeout(() => setCopiedUrl(false), 2000)
                          }}>
                          {copiedUrl ? <Check size={13} style={{ color: 'var(--green)' }} /> : <Copy size={13} />}
                          {copiedUrl ? 'Kopioitu!' : 'Kopioi'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ── Huoltohistoria (only when editing) ─────────────────────── */}
            {editing && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.1rem', marginTop: '.25rem' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', marginBottom: '.85rem', display: 'flex', alignItems: 'center', gap: '.5rem', color: 'var(--text)' }}>
                  <Wrench size={15} style={{ color: 'var(--violet)' }} /> Huoltohistoria
                </div>

                {/* History list */}
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
                            {!h.tehty ? (
                              <span style={{ fontSize: '.68rem', color: 'var(--red)', fontWeight: 700, background: '#FEE2E2', padding: '.15rem .45rem', borderRadius: 4 }}>AVOINNA</span>
                            ) : (
                              <span style={{ fontSize: '.68rem', color: 'var(--green)', fontWeight: 700, background: '#D1FAE5', padding: '.15rem .45rem', borderRadius: 4 }}>TEHTY</span>
                            )}
                            {canService && !h.tehty && (
                              <button
                                className="btn btn-sm"
                                style={{ background: 'var(--green)', color: 'white', border: 'none', fontSize: '.72rem', padding: '.25rem .55rem', borderRadius: 'var(--radius)', cursor: 'pointer' }}
                                onClick={() => markServiceDone(h.id)}>
                                Kuittaa
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                className="btn btn-sm"
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

                {/* Request maintenance */}
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.85rem 1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '.6rem', cursor: 'pointer', fontSize: '.87rem', fontWeight: serviceRequest ? 700 : 400, color: serviceRequest ? 'var(--red)' : 'var(--text2)', userSelect: 'none' }}>
                    <input
                      type="radio"
                      checked={serviceRequest}
                      onChange={() => setServiceRequest(v => !v)}
                      style={{ accentColor: 'var(--red)', cursor: 'pointer', width: 16, height: 16 }} />
                    Tilaa huolto
                  </label>
                  {serviceRequest && (
                    <div style={{ marginTop: '.7rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                      <textarea
                        className="input-field"
                        rows={3}
                        placeholder="Kuvaus huoltotarpeesta..."
                        value={serviceNote}
                        onChange={e => setServiceNote(e.target.value)}
                        style={{ resize: 'vertical', fontSize: '.85rem' }}
                        autoFocus
                      />
                      <div style={{ fontSize: '.72rem', color: 'var(--text3)' }}>
                        Huoltopyyntö luo kiireellisen tehtävän Huolto-tiimille.
                      </div>
                      {serviceError && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '.5rem .75rem', fontSize: '.78rem', color: 'var(--red)' }}>
                          ⚠️ {serviceError}
                        </div>
                      )}
                      <button
                        className="btn btn-primary"
                        onClick={submitServiceRequest}
                        disabled={savingService || !serviceNote.trim()}
                        style={{ alignSelf: 'flex-end', background: 'var(--red)', borderColor: 'var(--red)' }}>
                        {savingService ? 'Lähetetään...' : 'Lähetä huoltopyyntö'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
