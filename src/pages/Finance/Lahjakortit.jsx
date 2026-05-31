import { useEffect, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { supabaseAdmin } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'
import { useAuth } from '../../context/AuthContext'

const SERVICES = [
  { label: 'Valitse palvelu...', value: '', price: '' },
  { label: 'Hieronta 30 min – 30 €', value: 'Hieronta 30min', price: '30' },
  { label: 'Hieronta 45 min – 45 €', value: 'Hieronta 45min', price: '45' },
  { label: 'Hieronta 60 min – 55 €', value: 'Hieronta 60min', price: '55' },
  { label: 'Hieronta 75 min – 65 €', value: 'Hieronta 75min', price: '65' },
  { label: 'Hieronta 90 min – 75 €', value: 'Hieronta 90min', price: '75' },
  { label: 'Hieronta 120 min – 85 €', value: 'Hieronta 120min', price: '85' },
  { label: 'Purentalihashieronta 45 min – 50 €', value: 'Purentalihashieronta 45min', price: '50' },
  { label: 'Hieronta & fysioterapia – 100 €', value: 'Hieronta & fysioterapia', price: '100' },
  { label: 'Äitiysfysioterapia ensikäynti – 83 €', value: 'Äitiysfysioterapia ensikäynti', price: '83' },
  { label: 'Äitiysfysioterapiapaketti – 155 €', value: 'Äitiysfysioterapiapaketti', price: '155' },
  { label: 'Vapaa summa', value: 'Vapaa summa', price: '' },
]

const PAYMENT_METHODS = [
  'Verkkokauppa', 'Maksupääte', 'Hyvinvointietu', 'Käteinen', 'Lasku', 'MobilePay', 'Muu',
]

const TODAY = new Date().toISOString().slice(0, 10)

const empty = {
  code: '',
  service: '',
  price: '',
  payment_method: '',
  sale_date: TODAY,
  notes: '',
}

function statusBadge(r) {
  const used = r.used_amount || 0
  const price = r.price || 0
  if (used >= price && price > 0) return <span className="badge badge-red">Käytetty</span>
  if (used > 0) return <span className="badge badge-yellow">Osittain</span>
  return <span className="badge badge-green">Aktiivinen</span>
}

export default function Lahjakortit() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabaseAdmin.from('lahjakortit').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function handleServiceChange(e) {
    const val = e.target.value
    const svc = SERVICES.find(s => s.value === val)
    setForm(f => ({ ...f, service: val, price: svc?.price ?? f.price }))
  }

  const canSave = form.code.trim() && form.payment_method

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const { error } = await supabaseAdmin.from('lahjakortit').insert({
      code: form.code.trim(),
      service: form.service || null,
      price: form.price !== '' ? parseFloat(form.price) : null,
      payment_method: form.payment_method || null,
      sale_date: form.sale_date || TODAY,
      notes: form.notes.trim() || null,
      created_by: profile?.id || null,
    })
    setSaving(false)
    if (error) { alert('Tallennus epäonnistui: ' + error.message); return }
    setShowModal(false)
    setForm(empty)
    await fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko lahjakortti?')) return
    await supabaseAdmin.from('lahjakortit').delete().eq('id', id)
    fetchData()
  }

  const filtered = rows.filter(r =>
    r.code?.toLowerCase().includes(search.toLowerCase()) ||
    r.seller_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.service?.toLowerCase().includes(search.toLowerCase())
  )

  const active = rows.filter(r => (r.used_amount || 0) < (r.price || 0)).length
  const totalValue = rows.reduce((s, r) => s + (r.price || 0), 0)

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
          <div className="stat-label">Kokonaisarvo</div>
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
          <input className="search-input" placeholder="Hae tunnuksella, myyjällä tai palvelulla..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tunnus / nro</th>
              <th>Palvelu</th>
              <th>Arvo</th>
              <th>Käytetty</th>
              <th>Maksutapa</th>
              <th>Myyjä</th>
              <th>Myyty</th>
              <th>Tila</th>
              <th>Muistiinpanot</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="table-empty">Ei lahjakortteja.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '.05em' }}>{r.code}</td>
                <td style={{ fontSize: '.82rem' }}>{r.service || '—'}</td>
                <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{r.price != null ? r.price.toFixed(2) + ' €' : '—'}</td>
                <td style={{ color: 'var(--text3)' }}>{r.used_amount != null && r.used_amount > 0 ? r.used_amount.toFixed(2) + ' €' : '—'}</td>
                <td>{r.payment_method || '—'}</td>
                <td style={{ fontSize: '.82rem' }}>{r.seller_name || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.sale_date ? new Date(r.sale_date).toLocaleDateString('fi-FI') : '—'}</td>
                <td>{statusBadge(r)}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 140 }}>{r.notes || '—'}</td>
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
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !canSave}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <div className="form-grid">

            <div className="input-group">
              <label className="input-label">Tunnus / nro <span style={{ color: 'var(--red)' }}>*</span></label>
              <input className="input-field" name="code" placeholder="Lahjakortin tunnus tai numero" value={form.code} onChange={handleChange} />
            </div>

            <div className="input-group">
              <label className="input-label">Palvelu</label>
              <select className="input-field" name="service" value={form.service} onChange={handleServiceChange}>
                {SERVICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Summa (€)</label>
              <input className="input-field" name="price" type="number" step="0.01" min="0" placeholder="0.00" value={form.price} onChange={handleChange} />
              {form.service && form.service !== 'Vapaa summa' && (
                <div style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: '.25rem' }}>
                  Oletushinta haettu palvelusta – voit muuttaa tarvittaessa
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Maksutapa <span style={{ color: 'var(--red)' }}>*</span></label>
              <select className="input-field" name="payment_method" value={form.payment_method} onChange={handleChange}>
                <option value="">Valitse maksutapa...</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Myyntipäivä</label>
              <input className="input-field" name="sale_date" type="date" value={form.sale_date} onChange={handleChange} />
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
