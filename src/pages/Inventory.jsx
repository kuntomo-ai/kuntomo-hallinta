import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/ui/Modal'

const empty = { name: '', category: '', ely: '', kempele: '', ostohinta: '', notes: '' }

function fmt(v, decimals = 2) {
  if (v == null || v === '' || isNaN(Number(v))) return '—'
  return Number(v).toLocaleString('fi-FI', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' €'
}

function downloadTemplate() {
  const csv = 'Tuote;Kategoria;ELY;Kempele;Ostohinta (ALV 0)\nEsimerkki tuote;Ravinto & lisät;10;5;2.50\n'
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'inventaario_pohja.csv'
  a.click()
}

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
    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name')
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
      ely: row.ely != null ? String(row.ely) : '',
      kempele: row.kempele != null ? String(row.kempele) : '',
      ostohinta: row.ostohinta != null ? String(row.ostohinta) : '',
      notes: row.notes || '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const ely = form.ely !== '' ? parseFloat(form.ely) : 0
    const kempele = form.kempele !== '' ? parseFloat(form.kempele) : 0
    const ostohinta = form.ostohinta !== '' ? parseFloat(form.ostohinta) : 0
    const maara = ely + kempele
    const yhteensa = maara * ostohinta

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      ely,
      kempele,
      quantity: maara,
      ostohinta,
      yhteensa: Math.round(yhteensa * 100) / 100,
      unit: 'kpl',
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

  const filtered = rows.filter(r =>
    !search ||
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.category?.toLowerCase().includes(search.toLowerCase())
  )

  const totalArvo = filtered.reduce((s, r) => s + (r.yhteensa || 0), 0)

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Inventaario</h1>
          <p className="page-subtitle">{rows.length} tuotetta · Arvo yht. {totalArvo.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
        </div>
        <div style={{ display: 'flex', gap: '.6rem' }}>
          <button className="btn btn-ghost" onClick={downloadTemplate}>
            <Upload size={15} /> Tuo Excel-pohja
          </button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(empty); setShowModal(true) }}>
            <Plus size={16} /> Lisää tuote
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1rem' }}>
        <div className="search-wrap" style={{ maxWidth: 380 }}>
          <Search size={15} />
          <input className="search-input" placeholder="Hae tuotetta..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>TUOTE</th>
              <th style={{ textAlign: 'center' }}>ELY</th>
              <th style={{ textAlign: 'center' }}>KEMPELE</th>
              <th style={{ textAlign: 'center' }}>MÄÄRÄ</th>
              <th style={{ textAlign: 'right' }}>OSTOHINTA (ALV 0)</th>
              <th style={{ textAlign: 'right' }}>YHTEENSÄ (ALV 0)</th>
              <th style={{ textAlign: 'center' }}>TOIMINNOT</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="table-empty">Ei tuotteita.</td></tr>
            ) : filtered.map(r => {
              const ely = r.ely ?? 0
              const kempele = r.kempele ?? 0
              const maara = r.quantity ?? (ely + kempele)
              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    {r.category && <div style={{ fontSize: '.72rem', color: 'var(--text3)' }}>{r.category}</div>}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{ely > 0 ? ely : '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{kempele > 0 ? kempele : '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{maara}</td>
                  <td style={{ textAlign: 'right' }}>{r.ostohinta ? fmt(r.ostohinta) : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.yhteensa ? fmt(r.yhteensa) : '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '.4rem', justifyContent: 'center' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><Edit2 size={14} /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {filtered.length > 0 && !loading && (
            <tfoot>
              <tr style={{ background: 'var(--bg2)', fontWeight: 700 }}>
                <td>Yhteensä ({filtered.length} tuotetta)</td>
                <td style={{ textAlign: 'center' }}>{filtered.reduce((s, r) => s + (r.ely || 0), 0)}</td>
                <td style={{ textAlign: 'center' }}>{filtered.reduce((s, r) => s + (r.kempele || 0), 0)}</td>
                <td style={{ textAlign: 'center' }}>{filtered.reduce((s, r) => s + (r.quantity || 0), 0)}</td>
                <td />
                <td style={{ textAlign: 'right', color: 'var(--violet)' }}>{fmt(totalArvo)}</td>
                <td />
              </tr>
            </tfoot>
          )}
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
              <label className="input-label">Tuotenimi</label>
              <input className="input-field" name="name" placeholder="Tuotteen nimi" value={form.name} onChange={handleChange} autoFocus />
            </div>
            <div className="input-group">
              <label className="input-label">Kategoria</label>
              <input className="input-field" name="category" placeholder="Esim. Ravinto & lisät" value={form.category} onChange={handleChange} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">ELY (kpl)</label>
                <input className="input-field" name="ely" type="number" step="1" min="0" placeholder="0" value={form.ely} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Kempele (kpl)</label>
                <input className="input-field" name="kempele" type="number" step="1" min="0" placeholder="0" value={form.kempele} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Ostohinta (ALV 0, €)</label>
              <input className="input-field" name="ostohinta" type="number" step="0.01" min="0" placeholder="0.00" value={form.ostohinta} onChange={handleChange} />
            </div>
            {(form.ely || form.kempele) && form.ostohinta && (
              <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 14px', fontSize: '.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text3)' }}>Yhteensä ({(parseFloat(form.ely)||0) + (parseFloat(form.kempele)||0)} kpl × {parseFloat(form.ostohinta).toFixed(2)} €)</span>
                  <span style={{ fontWeight: 700 }}>{(((parseFloat(form.ely)||0) + (parseFloat(form.kempele)||0)) * (parseFloat(form.ostohinta)||0)).toFixed(2)} €</span>
                </div>
              </div>
            )}
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
