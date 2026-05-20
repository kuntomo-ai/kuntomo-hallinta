import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/ui/Modal'

const SIJAINNIT = ['Kaikki', 'linnakangas', 'Etu-Lyötty', 'Kempele']

const empty = { sijainti: '', category: '', name: '', model: '', serial_number: '', price: '', purchase_date: '', notes: '', service_history: '' }

export default function Laiteluettelo() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSijainti, setFilterSijainti] = useState('Kaikki')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('laiteluettelo_items').select('*').order('sijainti').order('name')
    setRows(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      sijainti: row.sijainti || '',
      category: row.category || '',
      name: row.name || '',
      model: row.model || '',
      serial_number: row.serial_number || '',
      price: row.price != null ? String(row.price) : '',
      purchase_date: row.purchase_date || '',
      notes: row.notes || '',
      service_history: row.service_history || '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      sijainti: form.sijainti.trim() || null,
      category: form.category.trim() || null,
      name: form.name.trim(),
      model: form.model.trim() || null,
      serial_number: form.serial_number.trim() || null,
      price: form.price !== '' ? parseFloat(form.price) : null,
      purchase_date: form.purchase_date.trim() || null,
      notes: form.notes.trim() || null,
      service_history: form.service_history.trim() || null,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      await supabase.from('laiteluettelo_items').update(payload).eq('id', editing)
    } else {
      await supabase.from('laiteluettelo_items').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    setEditing(null)
    setForm(empty)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko laite?')) return
    await supabase.from('laiteluettelo_items').delete().eq('id', id)
    fetchData()
  }

  const filtered = rows.filter(r => {
    const matchSearch = !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.category?.toLowerCase().includes(search.toLowerCase()) || r.model?.toLowerCase().includes(search.toLowerCase()) || r.serial_number?.toLowerCase().includes(search.toLowerCase())
    const matchSijainti = filterSijainti === 'Kaikki' || r.sijainti === filterSijainti
    return matchSearch && matchSijainti
  })

  // Group by sijainti
  const grouped = filtered.reduce((acc, r) => {
    const key = r.sijainti || 'Tuntematon'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Laiteluettelo</h1>
          <p className="page-subtitle">Kuntosalin laitteet ja varusteet</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(empty); setShowModal(true) }}>
          <Plus size={16} /> Uusi laite
        </button>
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

      <div style={{ marginBottom: '.75rem', color: 'var(--text3)', fontSize: '.82rem' }}>
        {filtered.length} laitetta
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
                    <th>Nimi</th>
                    <th>Kategoria</th>
                    <th>Malli</th>
                    <th>Sarjanumero</th>
                    <th>Hinta</th>
                    <th>Hankintapvm</th>
                    <th>Muistiinpanot</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td>{r.category || '—'}</td>
                      <td>{r.model || '—'}</td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text3)' }}>{r.serial_number || '—'}</td>
                      <td>{r.price != null ? `${r.price.toLocaleString('fi-FI')} €` : '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{r.purchase_date || '—'}</td>
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
          </div>
        ))
      )}

      {showModal && (
        <Modal title={editing ? 'Muokkaa laitetta' : 'Uusi laite'} onClose={() => setShowModal(false)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div className="form-grid form-grid-2">
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
              <label className="input-label">Huoltohistoria</label>
              <textarea className="input-field" name="service_history" rows={2} value={form.service_history} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
