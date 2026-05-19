import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const PRODUCTS = [
  { id: 't-paita', label: 'T-Paita', price: 6 },
  { id: 'collegepaita', label: 'Collegepaita', price: 20 },
  { id: 'huppari', label: 'Huppari', price: 25 },
  { id: 'huppari-vetoketjullinen', label: 'Huppari vetoketjullinen', price: 25 },
]
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export default function Surveys() {
  const { profile, isAdmin } = useAuth()
  const [tab, setTab] = useState('henkilosto')
  const [surveyResponses, setSurveyResponses] = useState([])
  const [clothingOrders, setClothingOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const [clothForm, setClothForm] = useState({
    name: '',
    products: [],
    size: 'M',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchData()
    setClothForm(f => ({ ...f, name: profile?.full_name || profile?.email || '' }))
  }, [profile])

  async function fetchData() {
    setLoading(true)
    const [srRes, coRes] = await Promise.all([
      supabase.from('survey_responses').select('*').order('created_at', { ascending: false }),
      supabase.from('vaatetilaukset').select('*').order('created_at', { ascending: false }),
    ])
    setSurveyResponses(srRes.data || [])
    setClothingOrders(coRes.data || [])
    setLoading(false)
  }

  function toggleProduct(id) {
    setClothForm(f => ({
      ...f,
      products: f.products.includes(id) ? f.products.filter(p => p !== id) : [...f.products, id]
    }))
  }

  async function handleClothSave() {
    if (!clothForm.name.trim() || clothForm.products.length === 0) return
    setSaving(true)
    await supabase.from('vaatetilaukset').insert({
      name: clothForm.name.trim(),
      products: clothForm.products,
      size: clothForm.size,
      notes: clothForm.notes.trim() || null,
    })
    setSaving(false)
    setSaved(true)
    setClothForm(f => ({ ...f, products: [], notes: '' }))
    fetchData()
  }

  // Admin summary helpers
  const productCounts = {}
  const sizeCounts = {}
  clothingOrders.forEach(o => {
    (o.products || []).forEach(p => { productCounts[p] = (productCounts[p] || 0) + 1 })
    if (o.size) sizeCounts[o.size] = (sizeCounts[o.size] || 0) + 1
  })

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Kyselyt</h1>
          <p className="page-subtitle">Henkilöstökyselyt ja tilaukset</p>
        </div>
      </div>

      <div className="sub-tabs">
        <button className={`sub-tab${tab === 'henkilosto' ? ' active' : ''}`} onClick={() => setTab('henkilosto')}>Henkilöstökysely</button>
        <button className={`sub-tab${tab === 'vaatetus' ? ' active' : ''}`} onClick={() => setTab('vaatetus')}>Vaatetilaus</button>
      </div>

      {tab === 'henkilosto' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pvm</th>
                <th>Vastaaja</th>
                <th>Vastaukset</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="table-empty">Ladataan...</td></tr>
              ) : surveyResponses.length === 0 ? (
                <tr><td colSpan={3} className="table-empty">Ei vastauksia.</td></tr>
              ) : surveyResponses.map(r => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</td>
                  <td style={{ fontWeight: 600 }}>{r.respondent_name || '—'}</td>
                  <td style={{ fontSize: '.78rem', color: 'var(--text2)' }}>
                    {r.answers ? (
                      <details>
                        <summary style={{ cursor: 'pointer', color: 'var(--violet)', fontWeight: 600 }}>Näytä vastaukset</summary>
                        <pre style={{ marginTop: '.5rem', whiteSpace: 'pre-wrap', fontSize: '.75rem', color: 'var(--text2)' }}>{JSON.stringify(r.answers, null, 2)}</pre>
                      </details>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'vaatetus' && (
        <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', marginBottom: '1.25rem' }}>Tee tilaus</h3>
            {saved && (
              <div style={{ background: 'var(--green-subtle)', border: '1px solid rgba(0,184,148,.2)', borderRadius: 'var(--radius)', padding: '.75rem 1rem', marginBottom: '1rem', color: 'var(--green)', fontWeight: 600, fontSize: '.85rem' }}>
                Tilauksesi on tallennettu!
              </div>
            )}
            <div className="form-grid">
              <div className="input-group">
                <label className="input-label">Nimi</label>
                <input className="input-field" placeholder="Etunimi Sukunimi" value={clothForm.name} onChange={e => setClothForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Tuotteet</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginTop: '.25rem' }}>
                  {PRODUCTS.map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', fontSize: '.85rem' }}>
                      <input type="checkbox" checked={clothForm.products.includes(p.id)} onChange={() => toggleProduct(p.id)} style={{ accentColor: 'var(--violet)' }} />
                      <span style={{ fontWeight: clothForm.products.includes(p.id) ? 600 : 400 }}>{p.label}</span>
                      <span style={{ color: 'var(--text3)', fontSize: '.75rem' }}>{p.price} €</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Koko</label>
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.25rem' }}>
                  {SIZES.map(s => (
                    <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '.3rem', cursor: 'pointer' }}>
                      <input type="radio" name="size" value={s} checked={clothForm.size === s} onChange={() => setClothForm(f => ({ ...f, size: s }))} style={{ accentColor: 'var(--violet)' }} />
                      <span style={{ fontSize: '.85rem', fontWeight: clothForm.size === s ? 700 : 400 }}>{s}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Lisätietoja</label>
                <textarea className="input-field" rows={2} value={clothForm.notes} onChange={e => setClothForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <button className="btn btn-primary" onClick={handleClothSave} disabled={saving || clothForm.products.length === 0}>
                {saving ? 'Tallennetaan...' : 'Lähetä tilaus'}
              </button>
            </div>
          </div>

          {isAdmin && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', marginBottom: '1.25rem' }}>Koostekooste (Admin)</h3>
              <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1.5rem' }}>
                <div className="stat-card">
                  <div className="stat-label">Tilauksia yhteensä</div>
                  <div className="stat-value">{clothingOrders.length}</div>
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '.5rem' }}>Tuotteet</div>
                {Object.entries(productCounts).map(([pid, count]) => {
                  const prod = PRODUCTS.find(p => p.id === pid)
                  return (
                    <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.83rem', padding: '.35rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span>{prod?.label || pid}</span>
                      <strong>{count} kpl</strong>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '.5rem' }}>Koot</div>
                {SIZES.filter(s => sizeCounts[s]).map(s => (
                  <div key={s} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.83rem', padding: '.35rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{s}</span>
                    <strong>{sizeCounts[s]} kpl</strong>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '.5rem' }}>Tilaukset</div>
                {clothingOrders.map(o => (
                  <div key={o.id} style={{ padding: '.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '.83rem' }}>
                    <strong>{o.name}</strong> — {(o.products || []).join(', ')} — Koko {o.size}
                    {o.notes && <div style={{ color: 'var(--text3)', fontSize: '.75rem' }}>{o.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
