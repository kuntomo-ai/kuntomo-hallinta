import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'

const empty = { description: '', amount: '', entry_type: 'tulo', entry_date: new Date().toISOString().slice(0, 10), notes: '' }

export default function Kassavirta() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('kassavirta_entries').select('*').order('entry_date', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      description: row.description || '',
      amount: row.amount != null ? String(row.amount) : '',
      entry_type: row.entry_type || 'tulo',
      entry_date: row.entry_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      notes: row.notes || '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.description.trim() || !form.amount) return
    setSaving(true)
    const payload = {
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      entry_type: form.entry_type,
      entry_date: form.entry_date,
      notes: form.notes.trim() || null,
    }
    if (editing) {
      await supabase.from('kassavirta_entries').update(payload).eq('id', editing)
    } else {
      await supabase.from('kassavirta_entries').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    setEditing(null)
    setForm(empty)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko kirjaus?')) return
    await supabase.from('kassavirta_entries').delete().eq('id', id)
    fetchData()
  }

  const tulot = rows.filter(r => r.entry_type === 'tulo').reduce((s, r) => s + (r.amount || 0), 0)
  const menot = rows.filter(r => r.entry_type === 'meno').reduce((s, r) => s + (r.amount || 0), 0)
  const netto = tulot - menot

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Kassavirta</h1>
          <p className="page-subtitle">Tulot ja menot</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(empty); setShowModal(true) }}>
          <Plus size={16} /> Uusi kirjaus
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Tulot yhteensä</div>
          <div className="stat-value gold">{tulot.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Menot yhteensä</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>{menot.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Netto</div>
          <div className="stat-value" style={{ color: netto >= 0 ? 'var(--green)' : 'var(--red)' }}>{netto.toFixed(2)} €</div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Päivämäärä</th>
              <th>Kuvaus</th>
              <th>Tyyppi</th>
              <th>Summa</th>
              <th>Muistiinpanot</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="table-empty">Ladataan...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">Ei kassavirtakirjauksia.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: '.78rem' }}>{r.entry_date ? new Date(r.entry_date).toLocaleDateString('fi-FI') : '—'}</td>
                <td style={{ fontWeight: 600 }}>{r.description}</td>
                <td>
                  {r.entry_type === 'tulo'
                    ? <span className="badge badge-green">Tulo</span>
                    : <span className="badge badge-red">Meno</span>}
                </td>
                <td style={{ fontWeight: 700, color: r.entry_type === 'tulo' ? 'var(--green)' : 'var(--red)' }}>
                  {r.entry_type === 'meno' ? '-' : ''}{(r.amount || 0).toFixed(2)} €
                </td>
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

      {showModal && (
        <Modal title={editing ? 'Muokkaa kirjausta' : 'Uusi kassavirtakirjaus'} onClose={() => setShowModal(false)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Kuvaus</label>
              <input className="input-field" name="description" placeholder="Kuvaus" value={form.description} onChange={handleChange} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Tyyppi</label>
                <select className="input-field" name="entry_type" value={form.entry_type} onChange={handleChange}>
                  <option value="tulo">Tulo</option>
                  <option value="meno">Meno</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Summa (€)</label>
                <input className="input-field" name="amount" type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Päivämäärä</label>
              <input className="input-field" name="entry_date" type="date" value={form.entry_date} onChange={handleChange} />
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
