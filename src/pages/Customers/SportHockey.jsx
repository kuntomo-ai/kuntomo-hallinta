import { useEffect, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'

const empty = { team_name: '', league: '', city: '', contact_name: '', contact_email: '', contact_phone: '', notes: '' }

export default function SportHockey() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('sport_hockey').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    if (!form.team_name.trim()) return
    setSaving(true)
    await supabase.from('sport_hockey').insert({
      team_name: form.team_name.trim(),
      league: form.league.trim() || null,
      city: form.city.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm(empty)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko joukkue?')) return
    await supabase.from('sport_hockey').delete().eq('id', id)
    fetchData()
  }

  const filtered = rows.filter(r =>
    r.team_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.league?.toLowerCase().includes(search.toLowerCase()) ||
    r.city?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Sport & Hockey</h1>
          <p className="page-subtitle">Joukkueet ja yhteystiedot</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setShowModal(true) }}>
          <Plus size={16} /> Uusi joukkue
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <div className="search-wrap">
          <Search size={15} />
          <input className="search-input" placeholder="Hae joukkueella, sarjalla, kaupungilla..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Joukkue</th>
              <th>Sarja</th>
              <th>Kaupunki</th>
              <th>Yhteyshenkilö</th>
              <th>Email</th>
              <th>Puhelin</th>
              <th>Lisätty</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">Ei joukkueita.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 700 }}>{r.team_name}</td>
                <td>{r.league || '—'}</td>
                <td>{r.city || '—'}</td>
                <td>{r.contact_name || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.82rem' }}>{r.contact_email || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.82rem' }}>{r.contact_phone || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Uusi joukkue" onClose={() => setShowModal(false)} wide footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Joukkueen nimi</label>
              <input className="input-field" name="team_name" placeholder="Joukkueen nimi" value={form.team_name} onChange={handleChange} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Sarja</label>
                <input className="input-field" name="league" placeholder="SM-liiga, Mestis..." value={form.league} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Kaupunki</label>
                <input className="input-field" name="city" placeholder="Helsinki" value={form.city} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Yhteyshenkilö</label>
              <input className="input-field" name="contact_name" placeholder="Etunimi Sukunimi" value={form.contact_name} onChange={handleChange} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Email</label>
                <input className="input-field" name="contact_email" type="email" placeholder="yhteys@joukkue.fi" value={form.contact_email} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Puhelin</label>
                <input className="input-field" name="contact_phone" placeholder="+358 40 123 4567" value={form.contact_phone} onChange={handleChange} />
              </div>
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
