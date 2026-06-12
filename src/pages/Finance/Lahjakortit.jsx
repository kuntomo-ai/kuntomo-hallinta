import { useEffect, useState } from 'react'
import { Plus, Search, Trash2, Edit2, ShoppingCart } from 'lucide-react'
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
  { label: 'Hieronta 120 min – 95 €', value: 'Hieronta 120min', price: '95' },
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

const empty = { code: '', service: '', price: '', payment_method: '', sale_date: TODAY, notes: '' }

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

  // Uusi lahjakortti
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  // Muokkaus
  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState(empty)
  const [editSaving, setEditSaving] = useState(false)

  // Kirjaa käyttö
  const [saleRow, setSaleRow] = useState(null)
  const [saleAmount, setSaleAmount] = useState('')
  const [saleDate, setSaleDate] = useState(TODAY)
  const [saleNotes, setSaleNotes] = useState('')
  const [saleSaving, setSaleSaving] = useState(false)

  // Jaksonvalitsin
  const [period, setPeriod] = useState('month')
  const [periodDate, setPeriodDate] = useState(new Date())

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabaseAdmin.from('lahjakortit').select('*').order('sale_date', { ascending: false, nullsFirst: false })
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

  function handleEditChange(e) {
    const { name, value } = e.target
    setEditForm(f => ({ ...f, [name]: value }))
  }

  function handleEditServiceChange(e) {
    const val = e.target.value
    const svc = SERVICES.find(s => s.value === val)
    setEditForm(f => ({ ...f, service: val, price: svc?.price ?? f.price }))
  }

  function openEdit(r) {
    setEditRow(r)
    setEditForm({
      code: r.code || '',
      service: r.service || '',
      price: r.price != null ? String(r.price) : '',
      payment_method: r.payment_method || '',
      sale_date: r.sale_date || TODAY,
      notes: r.notes || '',
    })
  }

  function openSale(r) {
    const remaining = (r.price || 0) - (r.used_amount || 0)
    setSaleRow(r)
    setSaleAmount(remaining > 0 ? remaining.toFixed(2) : '')
    setSaleDate(TODAY)
    setSaleNotes('')
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

  async function handleEditSave() {
    if (!editRow) return
    setEditSaving(true)
    const { error } = await supabaseAdmin.from('lahjakortit').update({
      code: editForm.code.trim(),
      service: editForm.service || null,
      price: editForm.price !== '' ? parseFloat(editForm.price) : null,
      payment_method: editForm.payment_method || null,
      sale_date: editForm.sale_date || TODAY,
      notes: editForm.notes.trim() || null,
    }).eq('id', editRow.id)
    setEditSaving(false)
    if (error) { alert('Tallennus epäonnistui: ' + error.message); return }
    setEditRow(null)
    await fetchData()
  }

  async function handleSaleSubmit() {
    if (!saleRow || !saleAmount) return
    const amount = parseFloat(saleAmount)
    if (isNaN(amount) || amount <= 0) return
    setSaleSaving(true)
    const newUsed = (saleRow.used_amount || 0) + amount
    const noteAppend = `Käytetty ${amount.toFixed(2)} € (${saleDate})${saleNotes ? ': ' + saleNotes : ''}`
    const prevNotes = saleRow.notes ? saleRow.notes + ' | ' : ''
    const { error } = await supabaseAdmin.from('lahjakortit').update({
      used_amount: newUsed,
      notes: prevNotes + noteAppend,
    }).eq('id', saleRow.id)
    setSaleSaving(false)
    if (error) { alert('Tallennus epäonnistui: ' + error.message); return }
    setSaleRow(null)
    await fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko lahjakortti?')) return
    await supabaseAdmin.from('lahjakortit').delete().eq('id', id)
    fetchData()
  }

  function periodRows() {
    if (period === 'all') return rows
    return rows.filter(r => {
      if (!r.sale_date) return false
      const d = new Date(r.sale_date)
      if (period === 'day') return r.sale_date === periodDate.toISOString().slice(0, 10)
      if (period === 'month') return d.getFullYear() === periodDate.getFullYear() && d.getMonth() === periodDate.getMonth()
      if (period === 'year') return d.getFullYear() === periodDate.getFullYear()
      return true
    })
  }

  function periodLabel() {
    if (period === 'all') return null
    if (period === 'day') return periodDate.toLocaleDateString('fi-FI')
    if (period === 'month') return periodDate.toLocaleDateString('fi-FI', { month: 'long', year: 'numeric' })
    return String(periodDate.getFullYear())
  }

  function navigate(dir) {
    const d = new Date(periodDate)
    if (period === 'day') d.setDate(d.getDate() + dir)
    else if (period === 'month') d.setMonth(d.getMonth() + dir)
    else if (period === 'year') d.setFullYear(d.getFullYear() + dir)
    setPeriodDate(d)
  }

  const pRows = periodRows()
  const todayTotal = rows.filter(r => r.sale_date === TODAY).reduce((s, r) => s + (r.price || 0), 0)
  const periodTotal = pRows.reduce((s, r) => s + (r.price || 0), 0)
  const periodCount = pRows.length
  const periodAvg = periodCount > 0 ? periodTotal / periodCount : 0

  const filtered = rows.filter(r =>
    r.code?.toLowerCase().includes(search.toLowerCase()) ||
    r.seller_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.service?.toLowerCase().includes(search.toLowerCase())
  )

  const active = rows.filter(r => (r.used_amount || 0) < (r.price || 0)).length
  const totalValue = rows.reduce((s, r) => s + (r.price || 0), 0)
  const remainingValue = rows.reduce((s, r) => s + Math.max(0, (r.price || 0) - (r.used_amount || 0)), 0)

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

      {/* Jaksonvalitsin */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['day', 'month', 'year', 'all'].map(p => (
          <button
            key={p}
            onClick={() => { setPeriod(p); setPeriodDate(new Date()) }}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontWeight: period === p ? 700 : 400,
              background: period === p ? 'var(--white, #fff)' : 'transparent',
              color: period === p ? 'var(--violet)' : 'var(--text3)',
              boxShadow: period === p ? '0 1px 4px rgba(0,0,0,.12)' : 'none',
              fontSize: '.9rem',
            }}
          >
            {p === 'day' ? 'Päivä' : p === 'month' ? 'Kuukausi' : p === 'year' ? 'Vuosi' : 'Kaikki'}
          </button>
        ))}
        {period !== 'all' && (
          <>
            <button onClick={() => navigate(-1)} style={{ background: 'var(--white, #fff)', border: 'none', borderRadius: 20, width: 32, height: 32, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>‹</button>
            <span style={{ fontWeight: 600, minWidth: 130, textAlign: 'center', fontSize: '.9rem' }}>{periodLabel()}</span>
            <button onClick={() => navigate(1)} style={{ background: 'var(--white, #fff)', border: 'none', borderRadius: 20, width: 32, height: 32, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>›</button>
          </>
        )}
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Myynti tänään</div>
          <div className="stat-value gold">{todayTotal.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Jakson myynti</div>
          <div className="stat-value gold">{periodTotal.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kirjauksia</div>
          <div className="stat-value">{periodCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Keskiarvo / kirjaus</div>
          <div className="stat-value">{periodAvg.toFixed(2)} €</div>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-label">Aktiiviset kortit</div>
          <div className="stat-value">{active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kokonaisarvo</div>
          <div className="stat-value">{totalValue.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Jäljellä yhteensä</div>
          <div className="stat-value">{remainingValue.toFixed(2)} €</div>
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
              <th>Jäljellä</th>
              <th>Maksutapa</th>
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
            ) : filtered.map(r => {
              const remaining = Math.max(0, (r.price || 0) - (r.used_amount || 0))
              const isFullyUsed = (r.used_amount || 0) >= (r.price || 0) && (r.price || 0) > 0
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '.05em' }}>{r.code}</td>
                  <td style={{ fontSize: '.82rem' }}>{r.service || '—'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{r.price != null ? r.price.toFixed(2) + ' €' : '—'}</td>
                  <td style={{ color: 'var(--text3)' }}>{r.used_amount != null && r.used_amount > 0 ? r.used_amount.toFixed(2) + ' €' : '—'}</td>
                  <td style={{ fontWeight: 600, color: remaining > 0 ? 'var(--green)' : 'var(--text4)' }}>
                    {remaining > 0 ? remaining.toFixed(2) + ' €' : '—'}
                  </td>
                  <td>{r.payment_method || '—'}</td>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.sale_date ? new Date(r.sale_date).toLocaleDateString('fi-FI') : '—'}</td>
                  <td>{statusBadge(r)}</td>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 140 }}>{r.notes || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      {!isFullyUsed && (
                        <button className="btn btn-primary btn-sm" title="Kirjaa käyttö" onClick={() => openSale(r)}>
                          <ShoppingCart size={13} />
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" title="Muokkaa" onClick={() => openEdit(r)}>
                        <Edit2 size={13} />
                      </button>
                      <button className="btn btn-danger btn-sm" title="Poista" onClick={() => handleDelete(r.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Uusi lahjakortti */}
      {showModal && (
        <Modal title="Uusi lahjakortti" onClose={() => setShowModal(false)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !canSave}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <LahjakorttiForms form={form} onChange={handleChange} onServiceChange={handleServiceChange} />
        </Modal>
      )}

      {/* Muokkaa lahjakorttia */}
      {editRow && (
        <Modal title={`Muokkaa — ${editRow.code}`} onClose={() => setEditRow(null)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditRow(null)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? 'Tallennetaan...' : 'Tallenna muutokset'}
            </button>
          </>
        }>
          <LahjakorttiForms form={editForm} onChange={handleEditChange} onServiceChange={handleEditServiceChange} />
        </Modal>
      )}

      {/* Kirjaa käyttö */}
      {saleRow && (
        <Modal title={`Kirjaa käyttö — ${saleRow.code}`} onClose={() => setSaleRow(null)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setSaleRow(null)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSaleSubmit} disabled={saleSaving || !saleAmount}>
              {saleSaving ? 'Tallennetaan...' : 'Kirjaa käyttö'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div style={{ padding: '.6rem .9rem', background: 'var(--surface2)', borderRadius: 8, fontSize: '.85rem', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Arvo: <strong>{(saleRow.price || 0).toFixed(2)} €</strong></span>
                <span>Käytetty: <strong>{(saleRow.used_amount || 0).toFixed(2)} €</strong></span>
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>
                  Jäljellä: {Math.max(0, (saleRow.price || 0) - (saleRow.used_amount || 0)).toFixed(2)} €
                </span>
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Käytettävä summa (€) *</label>
              <input
                className="input-field"
                type="number"
                step="0.01"
                min="0.01"
                max={(saleRow.price || 0) - (saleRow.used_amount || 0)}
                placeholder="0.00"
                value={saleAmount}
                onChange={e => setSaleAmount(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.4rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const rem = (saleRow.price || 0) - (saleRow.used_amount || 0)
                  setSaleAmount(rem.toFixed(2))
                }}>Koko jäljellä oleva</button>
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Käyttöpäivä</label>
              <input className="input-field" type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Muistiinpanot</label>
              <textarea className="input-field" rows={2} placeholder="Esim. asiakas, hieroja..." value={saleNotes} onChange={e => setSaleNotes(e.target.value)} style={{ resize: 'vertical' }} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function LahjakorttiForms({ form, onChange, onServiceChange }) {
  return (
    <div className="form-grid">
      <div className="input-group">
        <label className="input-label">Tunnus / nro <span style={{ color: 'var(--red)' }}>*</span></label>
        <input className="input-field" name="code" placeholder="Lahjakortin tunnus tai numero" value={form.code} onChange={onChange} />
      </div>
      <div className="input-group">
        <label className="input-label">Palvelu</label>
        <select className="input-field" name="service" value={form.service} onChange={onServiceChange}>
          {SERVICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div className="input-group">
        <label className="input-label">Summa (€)</label>
        <input className="input-field" name="price" type="number" step="0.01" min="0" placeholder="0.00" value={form.price} onChange={onChange} />
      </div>
      <div className="input-group">
        <label className="input-label">Maksutapa <span style={{ color: 'var(--red)' }}>*</span></label>
        <select className="input-field" name="payment_method" value={form.payment_method} onChange={onChange}>
          <option value="">Valitse maksutapa...</option>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="input-group">
        <label className="input-label">Myyntipäivä</label>
        <input className="input-field" name="sale_date" type="date" value={form.sale_date} onChange={onChange} />
      </div>
      <div className="input-group">
        <label className="input-label">Muistiinpanot</label>
        <textarea className="input-field" name="notes" rows={2} value={form.notes} onChange={onChange} style={{ resize: 'vertical' }} />
      </div>
    </div>
  )
}
