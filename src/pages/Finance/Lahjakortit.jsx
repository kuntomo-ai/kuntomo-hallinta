import { useEffect, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'

const empty = { code: '', value: '', recipient_name: '', expires_at: '', notes: '' }

function statusBadge(status) {
  if (status === 'aktiivinen') return <span className="badge badge-green">Aktiivinen</span>
  if (status === 'käytetty') return <span className="badge badge-gray">Käytetty</span>
  if (status === 'vanhentunut') return <span className="badge badge-red">Vanhentunut</span>
  return <span className="badge badge-gray">{status || '—'}</span>
}

export default function Lahjakortit() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('lahjakortit').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    if (!form.code.trim()) return
    setSaving(true)
    await supabase.from('lahjakortit').insert({
      code: form.code.trim(),
      value: form.value ? parseFloat(form.value) : null,
      recipient_name: form.recipient_name.trim() || null,
      sold_at: new Date().toISOString(),
      expires_at: form.expires_at || null,
      status: 'aktiivinen',
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm(empty)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko lahjakortti?')) return
    await supabase.from('lahjakortit').delete().eq('id', id)
    fetchData()
  }

  const filtered = rows.filter(r => r.code?.toLowerCase().includes(search.toLowerCase()) || r.recipient_name?.toLowerCase().includes(search.toLowerCase()))

  const active = rows.filter(r => r.status === 'aktiivinen').length
  const totalValue = rows.filter(r => r.status === 'aktiivinen').reduce((s, r) => s + (r.value || 0), 0)

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Lahjakortit</h1>
          <p className="page-subtitle">Hallitse lahjakortteja</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setShowModal(true) }}>
          <Plus size={16} /> Uusi lahjakortti
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-label">Aktiiviset kortit</div>
          <div className="stat-value">{active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Aktiivinen arvo</div>
          <div className="stat-value gold">{totalValue.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kortit yhteensä</div>
          <div className="stat-value">{rows.length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <div className="search-wrap">
          <Search size={15} />
          <input className="search-input" placeholder="Hae tunnuksella tai saajalla..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tunnus / nro</th>
              <th>Arvo</th>
              <th>Saaja</th>
              <th>Myyty</th>
              <th>Voimassa asti</th>
              <th>Tila</th>
              <th>Muistiinpanot</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">Ei lahjakortteja.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '.05em' }}>{r.code}</td>
                <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{r.value != null ? r.value.toFixed(2) + ' €' : '—'}</td>
                <td>{r.recipient_name || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.sold_at ? new Date(r.sold_at).toLocaleDateString('fi-FI') : '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.expires_at ? new Date(r.expires_at).toLocaleDateString('fi-FI') : '—'}</td>
                <td>{statusBadge(r.status)}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 160 }}>{r.notes || '—'}</td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Uusi lahjakortti" onClose={() => setShowModal(false)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Tunnus / nro</label>
              <input className="input-field" name="code" placeholder="Lahjakortin tunnus / nro" value={form.code} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Arvo (€)</label>
              <input className="input-field" name="value" type="number" step="0.01" min="0" placeholder="0.00" value={form.value} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Saajan nimi</label>
              <input className="input-field" name="recipient_name" placeholder="Etunimi Sukunimi" value={form.recipient_name} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Voimassa asti</label>
              <input className="input-field" name="expires_at" type="date" value={form.expires_at} onChange={handleChange} />
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
