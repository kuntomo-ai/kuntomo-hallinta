import { useEffect, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'

const JASENYYSTYYPIT = ['10x kortti', 'Kuukausikortti', 'Hieronta & Fysioterapia', 'Hieronta & Fysioterapia 100€']
const MAKSUTAVAT = ['Käteinen', 'Kortti', 'Lasku', 'MobilePay', 'Lahjakortti', 'Eazybreak', 'SmartumPay', 'ePassi']

const empty = { customer_name: '', membership_type: JASENYYSTYYPIT[0], price: '', start_date: '', payment_method: MAKSUTAVAT[0], notes: '' }

export default function JasenSales() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [todayTotal, setTodayTotal] = useState(0)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabaseAdmin.from('jasenmyynti').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    const today = new Date().toISOString().slice(0, 10)
    const todayRows = (data || []).filter(r => r.created_at?.slice(0, 10) === today)
    setTodayTotal(todayRows.reduce((s, r) => s + (r.price || 0), 0))
    setLoading(false)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    if (!form.customer_name.trim() || !form.price) return
    setSaving(true)
    await supabaseAdmin.from('jasenmyynti').insert({
      customer_name: form.customer_name.trim(),
      membership_type: form.membership_type,
      price: parseFloat(form.price),
      start_date: form.start_date || null,
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
    if (!confirm('Poistetaanko jäsenmyyntikirjaus?')) return
    await supabaseAdmin.from('jasenmyynti').delete().eq('id', id)
    fetchData()
  }

  const filtered = rows.filter(r => r.customer_name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Jäsenmyynti</h1>
          <p className="page-subtitle">Kirjaa ja seuraa jäsenyyksien myyntiä</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setShowModal(true) }}>
          <Plus size={16} /> Uusi jäsenmyynti
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
              <th>Jäsenyystyyppi</th>
              <th>Hinta</th>
              <th>Alkaa</th>
              <th>Maksutapa</th>
              <th>Muistiinpanot</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">Ei jäsenmyyntikirjauksia.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: '.78rem' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</td>
                <td style={{ fontWeight: 600 }}>{r.customer_name}</td>
                <td>{r.membership_type}</td>
                <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{(r.price || 0).toFixed(2)} €</td>
                <td>{r.start_date ? new Date(r.start_date).toLocaleDateString('fi-FI') : '—'}</td>
                <td>{r.payment_method}</td>
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
        <Modal title="Uusi jäsenmyynti" onClose={() => setShowModal(false)} footer={
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
              <label className="input-label">Jäsenyystyyppi</label>
              <select className="input-field" name="membership_type" value={form.membership_type} onChange={handleChange}>
                {JASENYYSTYYPIT.map(j => <option key={j}>{j}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Hinta (€)</label>
              <input className="input-field" name="price" type="number" step="0.01" min="0" placeholder="0.00" value={form.price} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Jäsenyys alkaa</label>
              <input className="input-field" name="start_date" type="date" value={form.start_date} onChange={handleChange} />
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
    </div>
  )
}
