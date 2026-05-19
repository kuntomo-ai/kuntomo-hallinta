import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'

const empty = { account_name: '', account_group: 'tuotot', amount: '', period: '' }

export default function Tulos() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('tulos_account_entries').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    if (!form.account_name.trim() || !form.amount) return
    setSaving(true)
    await supabase.from('tulos_account_entries').insert({
      account_name: form.account_name.trim(),
      account_group: form.account_group,
      amount: parseFloat(form.amount),
      period: form.period.trim() || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm(empty)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko kirjaus?')) return
    await supabase.from('tulos_account_entries').delete().eq('id', id)
    fetchData()
  }

  const tuotot = rows.filter(r => r.account_group === 'tuotot')
  const kulut = rows.filter(r => r.account_group === 'kulut')
  const tuototSum = tuotot.reduce((s, r) => s + (r.amount || 0), 0)
  const kulutSum = kulut.reduce((s, r) => s + (r.amount || 0), 0)
  const tulos = tuototSum - kulutSum

  function renderGroup(items, title, sum, color) {
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '.75rem', color }}>{title}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tili</th>
                <th>Tilikausi</th>
                <th>Summa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={4} className="table-empty">Ei kirjauksia.</td></tr>
              ) : items.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.account_name}</td>
                  <td style={{ color: 'var(--text3)' }}>{r.period || '—'}</td>
                  <td style={{ fontWeight: 700, color }}>{(r.amount || 0).toFixed(2)} €</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button></td>
                </tr>
              ))}
              {items.length > 0 && (
                <tr style={{ background: 'var(--bg2)' }}>
                  <td colSpan={2} style={{ fontWeight: 700, fontSize: '.83rem' }}>Yhteensä</td>
                  <td style={{ fontWeight: 800, color, fontSize: '1rem' }}>{sum.toFixed(2)} €</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Tuloslaskelma</h1>
          <p className="page-subtitle">Tuotot ja kulut</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setShowModal(true) }}>
          <Plus size={16} /> Uusi kirjaus
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)', padding: '2rem' }}>Ladataan...</div>
      ) : (
        <>
          {renderGroup(tuotot, 'Tuotot', tuototSum, 'var(--green)')}
          {renderGroup(kulut, 'Kulut', kulutSum, 'var(--red)')}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem' }}>Tulos (Tuotot − Kulut)</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.8rem', color: tulos >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {tulos.toFixed(2)} €
            </div>
          </div>
        </>
      )}

      {showModal && (
        <Modal title="Uusi tuloslaskelmakirjaus" onClose={() => setShowModal(false)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Tili</label>
              <input className="input-field" name="account_name" placeholder="Tilin nimi" value={form.account_name} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Ryhmä</label>
              <select className="input-field" name="account_group" value={form.account_group} onChange={handleChange}>
                <option value="tuotot">Tuotot</option>
                <option value="kulut">Kulut</option>
              </select>
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Summa (€)</label>
                <input className="input-field" name="amount" type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Tilikausi</label>
                <input className="input-field" name="period" placeholder="Esim. 2024" value={form.period} onChange={handleChange} />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
