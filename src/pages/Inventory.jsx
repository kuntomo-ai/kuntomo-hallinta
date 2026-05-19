import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/ui/Modal'

const empty = { name: '', category: '', quantity: '', unit: '', location: '', notes: '' }

export default function Inventory() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('inventory_items').select('*').order('updated_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      name: row.name || '',
      category: row.category || '',
      quantity: row.quantity != null ? String(row.quantity) : '',
      unit: row.unit || '',
      location: row.location || '',
      notes: row.notes || '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      quantity: form.quantity !== '' ? parseFloat(form.quantity) : null,
      unit: form.unit.trim() || null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      await supabase.from('inventory_items').update(payload).eq('id', editing)
    } else {
      await supabase.from('inventory_items').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    setEditing(null)
    setForm(empty)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko tuote?')) return
    await supabase.from('inventory_items').delete().eq('id', id)
    fetchData()
  }

  const filtered = rows.filter(r => r.name?.toLowerCase().includes(search.toLowerCase()) || r.category?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Inventaario</h1>
          <p className="page-subtitle">Hallitse tarvikkeita ja varastoa</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(empty); setShowModal(true) }}>
          <Plus size={16} /> Uusi tuote
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <div className="search-wrap">
          <Search size={15} />
          <input className="search-input" placeholder="Hae nimellä tai kategorialla..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nimi</th>
              <th>Kategoria</th>
              <th>Määrä</th>
              <th>Yksikkö</th>
              <th>Sijainti</th>
              <th>Muistiinpanot</th>
              <th>Päivitetty</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">Ei tuotteita.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td>{r.category || '—'}</td>
                <td style={{ fontWeight: 700 }}>{r.quantity != null ? r.quantity : '—'}</td>
                <td>{r.unit || '—'}</td>
                <td>{r.location || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 160 }}>{r.notes || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>{r.updated_at ? new Date(r.updated_at).toLocaleDateString('fi-FI') : '—'}</td>
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
        <Modal title={editing ? 'Muokkaa tuotetta' : 'Uusi tuote'} onClose={() => setShowModal(false)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Nimi</label>
              <input className="input-field" name="name" placeholder="Tuotteen nimi" value={form.name} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Kategoria</label>
              <input className="input-field" name="category" placeholder="Esim. Siivoustarvikkeet" value={form.category} onChange={handleChange} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Määrä</label>
                <input className="input-field" name="quantity" type="number" step="1" min="0" placeholder="0" value={form.quantity} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Yksikkö</label>
                <input className="input-field" name="unit" placeholder="kpl, l, kg..." value={form.unit} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Sijainti</label>
              <input className="input-field" name="location" placeholder="Esim. Varasto, hylly 2" value={form.location} onChange={handleChange} />
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
