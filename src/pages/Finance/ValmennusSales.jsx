import { useEffect, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'

const PALVELUT = ['Fysiikkavalmennus', 'Jatkuva valmennus', 'Harjoitusohjelma', 'Harjoitusohjelman päivitys', 'Pienryhmä', 'Muu']
const MAKSUTAVAT = ['Käteinen', 'Kortti', 'Lasku', 'MobilePay', 'Lahjakortti', 'Eazybreak', 'SmartumPay', 'ePassi']

const empty = { customer_name: '', service: PALVELUT[0], price: '', payment_method: MAKSUTAVAT[0], notes: '', recurring_months: null }

export default function ValmennusSales() {
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
    const { data } = await supabaseAdmin.from('valmennusmyynti').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    const today = new Date().toISOString().slice(0, 10)
    const todayRows = (data || []).filter(r => r.created_at?.slice(0, 10) === today)
    setTodayTotal(todayRows.reduce((s, r) => s + (r.price || 0), 0))
    setLoading(false)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({
      ...f,
      [name]: value,
      ...(name === 'service' && value !== 'Jatkuva valmennus' ? { recurring_months: null } : {}),
    }))
  }

  async function handleSave() {
    if (!form.customer_name.trim() || !form.price) return
    const isRecurring = form.service === 'Jatkuva valmennus'
    if (isRecurring && !form.recurring_months) return
    setSaving(true)

    const base = {
      customer_name: form.customer_name.trim(),
      service: form.service,
      price: parseFloat(form.price),
      payment_method: form.payment_method,
      notes: form.notes.trim() || null,
      seller_id: null,
    }

    if (isRecurring) {
      const months = parseInt(form.recurring_months)
      const now = new Date()
      const records = Array.from({ length: months }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
        return { ...base, created_at: d.toISOString() }
      })
      await supabaseAdmin.from('valmennusmyynti').insert(records)
    } else {
      await supabaseAdmin.from('valmennusmyynti').insert(base)
    }

    setSaving(false)
    setShowModal(false)
    setForm(empty)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko myyntikirjaus?')) return
    await supabaseAdmin.from('valmennusmyynti').delete().eq('id', id)
    fetchData()
  }

  const filtered = rows.filter(r => r.customer_name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Valmennusmyynti</h1>
          <p className="page-subtitle">Kirjaa ja seuraa valmennuspalveluiden myyntiä</p>
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
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: '.78rem' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</td>
                <td style={{ fontWeight: 600 }}>{r.customer_name}</td>
                <td>{r.service}</td>
                <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{(r.price || 0).toFixed(2)} €</td>
                <td>{r.payment_method}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 200 }}>{r.notes || '—'}</td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Uusi valmennusmyynti" onClose={() => setShowModal(false)} footer={
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
            {form.service === 'Jatkuva valmennus' && (
              <div className="input-group">
                <label className="input-label">Laskutus jatkuu (kuukausia)</label>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontWeight: form.recurring_months === String(n) ? 700 : 400 }}>
                      <input
                        type="radio"
                        name="recurring_months"
                        value={n}
                        checked={form.recurring_months === String(n)}
                        onChange={handleChange}
                      />
                      {n} kk
                    </label>
                  ))}
                </div>
              </div>
            )}
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
