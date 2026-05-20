import { useEffect, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'

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
  'Verkkokauppa',
  'Maksupääte',
  'Hyvinvointietu',
  'Käteinen',
  'Lasku',
  'MobilePay',
  'Muu',
]

const empty = {
  code: '',
  service: '',
  value: '',
  payment_method: '',
  payment_details: '',
  recipient_name: '',
  expires_at: '',
  notes: '',
}

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
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function handleServiceChange(e) {
    const val = e.target.value
    const svc = SERVICES.find(s => s.value === val)
    setForm(f => ({
      ...f,
      service: val,
      value: svc?.price ?? f.value,
    }))
  }

  const isMuu = form.payment_method === 'Muu'
  const canSave =
    form.code.trim() &&
    form.payment_method &&
    (!isMuu || form.payment_details.trim())

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    await supabase.from('lahjakortit').insert({
      code: form.code.trim(),
      service: form.service || null,
      value: form.value !== '' ? parseFloat(form.value) : null,
      payment_method: form.payment_method || null,
      payment_details: form.payment_details.trim() || null,
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

  const filtered = rows.filter(r =>
    r.code?.toLowerCase().includes(search.toLowerCase()) ||
    r.recipient_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.service?.toLowerCase().includes(search.toLowerCase())
  )

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
          <input className="search-input" placeholder="Hae tunnuksella, saajalla tai palvelulla..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tunnus / nro</th>
              <th>Palvelu</th>
              <th>Arvo</th>
              <th>Maksutapa</th>
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
              <tr><td colSpan={10} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="table-empty">Ei lahjakortteja.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '.05em' }}>{r.code}</td>
                <td style={{ fontSize: '.82rem' }}>{r.service || '—'}</td>
                <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{r.value != null ? r.value.toFixed(2) + ' €' : '—'}</td>
                <td>
                  {r.payment_method ? (
                    <span>
                      {r.payment_method}
                      {r.payment_details ? <span style={{ color: 'var(--text3)', fontSize: '.75rem', display: 'block' }}>{r.payment_details}</span> : null}
                    </span>
                  ) : '—'}
                </td>
                <td>{r.recipient_name || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.sold_at ? new Date(r.sold_at).toLocaleDateString('fi-FI') : '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.expires_at ? new Date(r.expires_at).toLocaleDateString('fi-FI') : '—'}</td>
                <td>{statusBadge(r.status)}</td>
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

            {/* Tunnus */}
            <div className="input-group">
              <label className="input-label">Tunnus / nro <span style={{ color: 'var(--red)' }}>*</span></label>
              <input className="input-field" name="code" placeholder="Lahjakortin tunnus tai numero" value={form.code} onChange={handleChange} />
            </div>

            {/* Palvelu */}
            <div className="input-group">
              <label className="input-label">Palvelu</label>
              <select className="input-field" name="service" value={form.service} onChange={handleServiceChange}>
                {SERVICES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Summa */}
            <div className="input-group">
              <label className="input-label">Summa (€)</label>
              <input
                className="input-field"
                name="value"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.value}
                onChange={handleChange}
              />
              {form.service && form.service !== 'Vapaa summa' && (
                <div style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: '.25rem' }}>
                  Oletushinta haettu palvelusta – voit muuttaa tarvittaessa
                </div>
              )}
            </div>

            {/* Maksutapa */}
            <div className="input-group">
              <label className="input-label">Maksutapa <span style={{ color: 'var(--red)' }}>*</span></label>
              <select className="input-field" name="payment_method" value={form.payment_method} onChange={handleChange}>
                <option value="">Valitse maksutapa...</option>
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Lisätiedot – pakollinen jos Muu */}
            {isMuu && (
              <div className="input-group">
                <label className="input-label">
                  Lisätiedot <span style={{ color: 'var(--red)' }}>*</span>
                  <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: '.35rem' }}>pakollinen kun maksutapa on Muu</span>
                </label>
                <input
                  className="input-field"
                  name="payment_details"
                  placeholder="Selitä maksutapa..."
                  value={form.payment_details}
                  onChange={handleChange}
                  style={{ borderColor: !form.payment_details.trim() ? 'var(--red)' : '' }}
                />
              </div>
            )}

            {/* Saajan nimi */}
            <div className="input-group">
              <label className="input-label">Saajan nimi</label>
              <input className="input-field" name="recipient_name" placeholder="Etunimi Sukunimi" value={form.recipient_name} onChange={handleChange} />
            </div>

            {/* Voimassaolo */}
            <div className="input-group">
              <label className="input-label">Voimassa asti</label>
              <input className="input-field" name="expires_at" type="date" value={form.expires_at} onChange={handleChange} />
            </div>

            {/* Muistiinpanot */}
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
