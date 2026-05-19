import { useEffect, useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const TABS = [
  { key: 'terapia', label: 'Terapiamyynti' },
  { key: 'valmennus', label: 'Valmennusmyynti' },
  { key: 'jasen', label: 'Jäsenmyynti' },
]

const TERAPIA_PALVELUT = [
  'Fysioterapia 45min', 'Fysioterapia 60min',
  'OMT / erikoisfysioterapia 30min', 'OMT / erikoisfysioterapia 45min', 'OMT / erikoisfysioterapia 60min',
  'Fasciakäsittely 60min', 'Purentalihasfysioterapia 45min', 'Purentalihasfysioterapia 60min',
  'Äitiysfysioterapia 60min', 'Äitiysfysio ensikäynti 75min', 'Muu',
]
const VALMENNUS_PALVELUT = ['Fysiikkavalmennus', 'Harjoitusohjelma', 'Harjoitusohjelman päivitys', 'Pienryhmä', 'Muu']
const JASENYYSTYYPIT = ['10x kortti', 'Kuukausikortti', 'Hieronta & Fysioterapia', 'Hieronta & Fysioterapia 100€']
const MAKSUTAVAT = ['Käteinen', 'Kortti', 'Lasku', 'MobilePay', 'Lahjakortti', 'Eazybreak', 'SmartumPay', 'ePassi']

const emptyTerapia = { customer_name: '', service: TERAPIA_PALVELUT[0], price: '', payment_method: MAKSUTAVAT[0], notes: '' }
const emptyValmennus = { customer_name: '', service: VALMENNUS_PALVELUT[0], price: '', payment_method: MAKSUTAVAT[0], notes: '' }
const emptyJasen = { customer_name: '', membership_type: JASENYYSTYYPIT[0], price: '', start_date: '', payment_method: MAKSUTAVAT[0], notes: '' }

function SalesForm({ tab, form, onChange, onSave, saving, giftDialog, giftCode, setGiftCode, onGiftOk, onGiftClose }) {
  return (
    <div className="card" style={{ padding: '1.25rem', alignSelf: 'start' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>
        Uusi kirjaus
      </h3>
      <div className="form-grid">
        <div className="input-group">
          <label className="input-label">Asiakkaan nimi</label>
          <input className="input-field" name="customer_name" placeholder="Etunimi Sukunimi" value={form.customer_name} onChange={onChange} />
        </div>

        {tab === 'terapia' && (
          <div className="input-group">
            <label className="input-label">Palvelu</label>
            <select className="input-field" name="service" value={form.service} onChange={onChange}>
              {TERAPIA_PALVELUT.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        )}

        {tab === 'valmennus' && (
          <div className="input-group">
            <label className="input-label">Palvelu</label>
            <select className="input-field" name="service" value={form.service} onChange={onChange}>
              {VALMENNUS_PALVELUT.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        )}

        {tab === 'jasen' && (
          <>
            <div className="input-group">
              <label className="input-label">Jäsenyystyyppi</label>
              <select className="input-field" name="membership_type" value={form.membership_type} onChange={onChange}>
                {JASENYYSTYYPIT.map(j => <option key={j}>{j}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Jäsenyys alkaa</label>
              <input className="input-field" name="start_date" type="date" value={form.start_date} onChange={onChange} />
            </div>
          </>
        )}

        <div className="input-group">
          <label className="input-label">Hinta (€)</label>
          <input className="input-field" name="price" type="number" step="0.01" min="0" placeholder="0.00" value={form.price} onChange={onChange} />
        </div>

        <div className="input-group">
          <label className="input-label">Maksutapa</label>
          <select className="input-field" name="payment_method" value={form.payment_method} onChange={onChange}>
            {MAKSUTAVAT.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div className="input-group">
          <label className="input-label">Muistiinpanot</label>
          <textarea className="input-field" name="notes" rows={2} value={form.notes} onChange={onChange} style={{ resize: 'vertical' }} />
        </div>

        <button className="btn btn-primary" onClick={onSave} disabled={saving} style={{ width: '100%' }}>
          {saving ? 'Tallennetaan...' : 'Tallenna kirjaus'}
        </button>
      </div>

      {giftDialog && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onGiftClose() }}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header"><span className="modal-title">Lahjakortin tunnus</span></div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Syötä lahjakortin tunnus / nro</label>
                <input className="input-field" placeholder="Lahjakortin tunnus / nro" value={giftCode} onChange={e => setGiftCode(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onGiftClose}>Ohita</button>
              <button className="btn btn-primary" onClick={onGiftOk}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Sales() {
  const [tab, setTab] = useState('terapia')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyTerapia)
  const [saving, setSaving] = useState(false)
  const [todayTotal, setTodayTotal] = useState(0)
  const [giftDialog, setGiftDialog] = useState(false)
  const [giftCode, setGiftCode] = useState('')

  const TABLE_MAP = { terapia: 'terapiamyynti', valmennus: 'valmennusmyynti', jasen: 'jasenmyynti' }
  const EMPTY_MAP = { terapia: emptyTerapia, valmennus: emptyValmennus, jasen: emptyJasen }

  useEffect(() => {
    setForm(EMPTY_MAP[tab])
    setSearch('')
    fetchData(tab)
  }, [tab])

  useEffect(() => {
    function onVoiceTerapia(e) {
      setTab('terapia')
      setForm(f => ({ ...emptyTerapia, ...e.detail }))
    }
    function onVoiceValmennus(e) {
      setTab('valmennus')
      setForm(f => ({ ...emptyValmennus, ...e.detail }))
    }
    window.addEventListener('voice-terapia', onVoiceTerapia)
    window.addEventListener('voice-valmennus', onVoiceValmennus)
    return () => {
      window.removeEventListener('voice-terapia', onVoiceTerapia)
      window.removeEventListener('voice-valmennus', onVoiceValmennus)
    }
  }, [])

  async function fetchData(activeTab) {
    setLoading(true)
    const table = TABLE_MAP[activeTab]
    const { data } = await supabase.from(table).select('*').order('created_at', { ascending: false })
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
      const note = data
        ? `Lahjakortti: ${giftCode}`
        : `Lahjakortti ${giftCode} – ei löydy järjestelmästä`
      setForm(f => ({ ...f, notes: f.notes ? f.notes + ` [${note}]` : note }))
    }
    setGiftDialog(false)
  }

  async function handleSave() {
    if (!form.customer_name.trim() || !form.price) return
    setSaving(true)
    const table = TABLE_MAP[tab]
    const base = {
      customer_name: form.customer_name.trim(),
      price: parseFloat(form.price),
      payment_method: form.payment_method,
      notes: form.notes.trim() || null,
    }
    if (tab === 'terapia' || tab === 'valmennus') {
      await supabase.from(table).insert({ ...base, service: form.service })
    } else {
      await supabase.from(table).insert({ ...base, membership_type: form.membership_type, start_date: form.start_date || null })
    }
    setSaving(false)
    setForm(EMPTY_MAP[tab])
    fetchData(tab)
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko kirjaus?')) return
    await supabase.from(TABLE_MAP[tab]).delete().eq('id', id)
    fetchData(tab)
  }

  const filtered = rows.filter(r => r.customer_name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Myynti</h1>
          <p className="page-subtitle">Kirjaa ja seuraa myyntiä</p>
        </div>
      </div>

      <div className="sub-tabs" style={{ marginBottom: '1.25rem' }}>
        {TABS.map(t => (
          <button key={t.key} className={`sub-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginBottom: '1.25rem' }}>
        <div className="stat-card">
          <div className="stat-label">Myynti tänään</div>
          <div className="stat-value gold">{todayTotal.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kirjauksia yhteensä</div>
          <div className="stat-value">{rows.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.25rem', alignItems: 'start' }}>
        <SalesForm
          tab={tab}
          form={form}
          onChange={handleChange}
          onSave={handleSave}
          saving={saving}
          giftDialog={giftDialog}
          giftCode={giftCode}
          setGiftCode={setGiftCode}
          onGiftOk={handleGiftOk}
          onGiftClose={() => setGiftDialog(false)}
        />

        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '.75rem' }}>
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
                  {tab === 'jasen' ? <th>Jäsenyystyyppi</th> : <th>Palvelu</th>}
                  <th>Hinta</th>
                  {tab === 'jasen' && <th>Alkaa</th>}
                  <th>Maksutapa</th>
                  <th>Muistiinpanot</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={tab === 'jasen' ? 8 : 7} className="table-empty">Ladataan...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={tab === 'jasen' ? 8 : 7} className="table-empty">Ei kirjauksia.</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: '.78rem' }}>
                      {new Date(r.created_at).toLocaleDateString('fi-FI')}
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.customer_name}</td>
                    <td>{tab === 'jasen' ? r.membership_type : r.service}</td>
                    <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{(r.price || 0).toFixed(2)} €</td>
                    {tab === 'jasen' && <td style={{ color: 'var(--text3)' }}>{r.start_date ? new Date(r.start_date).toLocaleDateString('fi-FI') : '—'}</td>}
                    <td>{r.payment_method}</td>
                    <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 180 }}>{r.notes || '—'}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
