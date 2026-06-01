import { useEffect, useState } from 'react'
import { Search, Edit2 } from 'lucide-react'
import { supabaseAdmin } from '../lib/supabase'
import Modal from '../components/ui/Modal'

const LOCATIONS = ['Kempele MIEHET', 'Kempele NAISET', 'Etu-Lyötty MIEHET', 'Etu-Lyötty NAISET']
const KEY_OPTIONS = ['kyllä', 'ei', '1 avain']
const YES_NO = ['kyllä', 'ei']

function statusBadge(val, field) {
  if (!val) return null
  const v = val.toLowerCase()
  if (v === 'kyllä') return <span className="badge badge-green">kyllä</span>
  if (v === 'ei') return <span className="badge badge-red">ei</span>
  return <span className="badge badge-yellow">{val}</span>
}

export default function Kaapit() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [location, setLocation] = useState(LOCATIONS[0])
  const [search, setSearch] = useState('')

  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabaseAdmin.from('lockers').select('*').order('location').order('locker_number')
    setRows(data || [])
    setLoading(false)
  }

  function openEdit(r) {
    setEditRow(r)
    setEditForm({
      two_keys: r.two_keys || 'kyllä',
      lock_works: r.lock_works || 'kyllä',
      has_keyring: r.has_keyring || 'kyllä',
      notes: r.notes || '',
    })
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

  const locationRows = rows.filter(r => r.location === location)
  const filtered = locationRows.filter(r =>
    !search || String(r.locker_number).includes(search) || r.notes?.toLowerCase().includes(search.toLowerCase())
  )

  // Stats for current location
  const issues = locationRows.filter(r =>
    r.lock_works === 'ei' || r.two_keys === 'ei' || r.two_keys === '1 avain' || r.has_keyring === 'ei'
  ).length
  const lockBroken = locationRows.filter(r => r.lock_works === 'ei').length
  const missingKeys = locationRows.filter(r => r.two_keys !== 'kyllä').length
  const noKeyring = locationRows.filter(r => r.has_keyring === 'ei').length

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Pukukaapit</h1>
          <p className="page-subtitle">Pukukaappien tiedot ja kunnossapito</p>
        </div>
      </div>

      {/* Osasto-välilehdet */}
      <div className="sub-tabs" style={{ marginBottom: '1.25rem' }}>
        {LOCATIONS.map(loc => (
          <button
            key={loc}
            className={`sub-tab${location === loc ? ' active' : ''}`}
            onClick={() => { setLocation(loc); setSearch('') }}
          >
            {loc}
          </button>
        ))}
      </div>

      {/* Tilastokortit */}
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
                  <td style={{ fontWeight: 700, fontSize: '1rem' }}>{r.locker_number}</td>
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
          title={`Muokkaa — ${editRow.location} kaappi ${editRow.locker_number}`}
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
          </div>
        </Modal>
      )}
    </div>
  )
}
