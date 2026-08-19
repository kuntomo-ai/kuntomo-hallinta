import { useEffect, useState } from 'react'
import { Plus, Search, Trash2, Receipt } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import ReceiptModal from '../../components/ReceiptModal'

const PALVELUT = [
  'Fysioterapia 45min', 'Fysioterapia 60min',
  'OMT / erikoisfysioterapia 30min', 'OMT / erikoisfysioterapia 45min', 'OMT / erikoisfysioterapia 60min',
  'Fasciakäsittely 60min', 'Purentalihasfysioterapia 45min', 'Purentalihasfysioterapia 60min',
  'Äitiysfysioterapia 60min', 'Äitiysfysio ensikäynti 75min', 'Muu',
]
const MAKSUTAVAT = ['Käteinen', 'Kortti', 'Lasku', 'MobilePay', 'Lahjakortti', 'Eazybreak', 'SmartumPay', 'ePassi']

const empty = { customer_name: '', service: PALVELUT[0], price: '', payment_method: MAKSUTAVAT[0], notes: '' }

export default function TerapiaSales() {
  const { user, isAdmin } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [todayTotal, setTodayTotal] = useState(0)
  const [giftDialog, setGiftDialog] = useState(false)
  const [giftCode, setGiftCode] = useState('')
  const [receiptModal, setReceiptModal] = useState(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('terapiamyynti').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    const today = new Date().toISOString().slice(0, 10)
    const todayRows = (data || []).filter(r => r.created_at?.slice(0, 10) === today)
    setTodayTotal(todayRows.reduce((s, r) => s + (r.price || 0), 0))
    setLoading(false)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (name === 'payment_method' && value === 'Lahjakortti') {
      setGiftDialog(true)
      setGiftCode('')
    }
  }

  async function handleGiftOk() {
    if (giftCode.trim()) {
      const { data } = await supabase.from('lahjakortit').select('*').eq('code', giftCode.trim()).single()
      if (!data) {
        setForm(f => ({ ...f, notes: f.notes ? f.notes + ` [Lahjakortti ${giftCode} – ei löydy järjestelmästä]` : `Lahjakortti ${giftCode} – ei löydy järjestelmästä` }))
      } else {
        setForm(f => ({ ...f, notes: f.notes ? f.notes + ` [Lahjakortti: ${giftCode}]` : `Lahjakortti: ${giftCode}` }))
      }
    }
    setGiftDialog(false)
  }

  async function handleSave() {
    if (!form.customer_name.trim() || !form.price) return
    setSaving(true)
    await supabase.from('terapiamyynti').insert({
      customer_name: form.customer_name.trim(),
      service: form.service,
      price: parseFloat(form.price),
      payment_method: form.payment_method,
      notes: form.notes.trim() || null,
      seller_id: null,
    })
    setSaving(false)
    setShowModal(false)
    setForm(empty)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko myyntikirjaus?')) return
    await supabase.from('terapiamyynti').delete().eq('id', id)
    fetchData()
  }

  const filtered = rows.filter(r => r.customer_name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Terapiamyynti</h1>
          <p className="page-subtitle">Kirjaa ja seuraa terapiapalveluiden myyntiä</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setShowModal(true) }}>
          <Plus size={16} /> Uusi myynti
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-label">Myynti tänään</div>
          <div className="stat-value gold">{todayTotal.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kirjauksia yhteensä</div>
          <div className="stat-value">{rows.length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <div className="search-wrap">
          <Search size={15} />
          <input className="search-input" placeholder="Hae asiakkaalla..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pvm</th>
              <th>Asiakas</th>
              <th>Palvelu</th>
              <th>Hinta</th>
              <th>Maksutapa</th>
              <th>Muistiinpanot</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="table-empty">Ei myyntikirjauksia.</td></tr>
            ) : filtered.map(r => {
              const canViewReceipt = r.receipt_url && (isAdmin || r.seller_id === user?.id)
              return (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: '.78rem' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</td>
                  <td style={{ fontWeight: 600 }}>{r.customer_name}</td>
                  <td>{r.service}</td>
                  <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{(r.price || 0).toFixed(2)} €</td>
                  <td>{r.payment_method}</td>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 200 }}>{r.notes || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
                      {canViewReceipt && (
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Näytä kuitti"
                          onClick={() => setReceiptModal(r.receipt_url)}
                          style={{ color: 'var(--violet)' }}
                        >
                          <Receipt size={14} />
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Uusi terapiamyynti" onClose={() => setShowModal(false)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Asiakkaan nimi</label>
              <input className="input-field" name="customer_name" placeholder="Etunimi Sukunimi" value={form.customer_name} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Palvelu</label>
              <select className="input-field" name="service" value={form.service} onChange={handleChange}>
                {PALVELUT.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Hinta (€)</label>
              <input className="input-field" name="price" type="number" step="0.01" min="0" placeholder="0.00" value={form.price} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Maksutapa</label>
              <select className="input-field" name="payment_method" value={form.payment_method} onChange={handleChange}>
                {MAKSUTAVAT.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Muistiinpanot</label>
              <textarea className="input-field" name="notes" rows={3} value={form.notes} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
          </div>
        </Modal>
      )}

      {giftDialog && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setGiftDialog(false) }}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <span className="modal-title">Lahjakortin tunnus</span>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Syötä lahjakortin tunnus / nro</label>
                <input className="input-field" placeholder="Lahjakortin tunnus / nro" value={giftCode} onChange={e => setGiftCode(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setGiftDialog(false)}>Ohita</button>
              <button className="btn btn-primary" onClick={handleGiftOk}>OK</button>
            </div>
          </div>
        </div>
      )}

      <ReceiptModal stored={receiptModal} onClose={() => setReceiptModal(null)} />
    </div>
  )
}
