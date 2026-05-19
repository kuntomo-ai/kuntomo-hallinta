import { useEffect, useState } from 'react'
import { Search, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'terapia', label: 'Terapiamyynti' },
  { key: 'valmennus', label: 'Valmennusmyynti' },
  { key: 'jasen', label: 'Jäsenmyynti' },
]

const MAKSUTAVAT_TERAPIA = [
  'Maksupääte', 'Käteinen', 'Hyvinvointietu',
  'Yrityslaskutus', 'Yrityskäynti', 'Lahjakortti', 'Muu',
]
const COMPANY_METHODS = ['Yrityslaskutus', 'Yrityskäynti']

const VALMENNUS_PALVELUT = ['Fysiikkavalmennus', 'Harjoitusohjelma', 'Harjoitusohjelman päivitys', 'Pienryhmä', 'Muu']
const JASENYYSTYYPIT = ['10x kortti', 'Kuukausikortti', 'Hieronta & Fysioterapia', 'Hieronta & Fysioterapia 100€']
const MAKSUTAVAT = ['Käteinen', 'Kortti', 'Lasku', 'MobilePay', 'Lahjakortti', 'Eazybreak', 'SmartumPay', 'ePassi']

const TODAY = new Date().toISOString().slice(0, 10)

// ─── Terapia form ─────────────────────────────────────────────────────────────

function TerapiaForm({ onSaved }) {
  const [products, setProducts] = useState([])
  const [companies, setCompanies] = useState([])
  const [persons, setPersons] = useState([])
  const [saving, setSaving] = useState(false)
  const [splitError, setSplitError] = useState(false)

  const [form, setForm] = useState({
    visit_date: TODAY,
    service: '',
    price: '',
    payment_methods: [],
    splits: {},
    company_id: '',
    company_person_id: '',
    company_person_name: '',
    notes: '',
  })

  useEffect(() => {
    supabase.from('hoitotuotteet').select('*').eq('active', true).order('name')
      .then(({ data }) => setProducts(data || []))
    supabase.from('companies').select('id, name').order('name')
      .then(({ data }) => setCompanies(data || []))
  }, [])

  const needsCompany = form.payment_methods.some(m => COMPANY_METHODS.includes(m))

  function togglePayment(m) {
    setForm(f => {
      const methods = f.payment_methods.includes(m)
        ? f.payment_methods.filter(x => x !== m)
        : [...f.payment_methods, m]
      return {
        ...f,
        payment_methods: methods,
        company_id: methods.some(x => COMPANY_METHODS.includes(x)) ? f.company_id : '',
        company_person_id: methods.some(x => COMPANY_METHODS.includes(x)) ? f.company_person_id : '',
        company_person_name: methods.some(x => COMPANY_METHODS.includes(x)) ? f.company_person_name : '',
      }
    })
  }

  function selectProduct(name) {
    const p = products.find(x => x.name === name)
    setForm(f => ({ ...f, service: name, price: p?.price > 0 ? String(p.price) : f.price }))
  }

  async function selectCompany(id, name) {
    setForm(f => ({ ...f, company_id: id, company_person_id: '', company_person_name: '' }))
    const { data } = await supabase.from('company_persons').select('*').eq('company_id', id).order('name')
    setPersons(data || [])
  }

  function selectPerson(p) {
    setForm(f => ({ ...f, company_person_id: p.id, company_person_name: p.name }))
  }

  function splitSum() {
    return form.payment_methods.reduce((s, m) => s + (parseFloat(form.splits[m]) || 0), 0)
  }

  function splitsValid() {
    if (form.payment_methods.length <= 1) return true
    return Math.abs(splitSum() - (parseFloat(form.price) || 0)) < 0.01
  }

  async function handleSubmit() {
    if (!form.service || !form.price || form.payment_methods.length === 0) return
    if (needsCompany && (!form.company_id || !form.company_person_id)) return
    if (!splitsValid()) { setSplitError(true); return }
    setSplitError(false)
    setSaving(true)

    const paymentStr = form.payment_methods.join(', ')
    const customerName = form.company_person_name || '—'

    await supabase.from('terapiamyynti').insert({
      customer_name: customerName,
      service: form.service,
      price: parseFloat(form.price),
      payment_method: paymentStr,
      notes: form.notes.trim() || null,
    })

    if (needsCompany && form.company_id && form.company_person_id) {
      const payType = form.payment_methods.find(m => COMPANY_METHODS.includes(m))
      await supabase.from('company_visits').insert({
        company_id: form.company_id,
        company_person_id: form.company_person_id,
        company_person_name: form.company_person_name,
        visit_date: form.visit_date,
        service: form.service,
        price: parseFloat(form.price),
        payment_type: payType,
        invoiced: false,
        notes: form.notes.trim() || null,
      })
    }

    setSaving(false)
    setForm({ visit_date: TODAY, service: '', price: '', payment_methods: [], splits: {}, company_id: '', company_person_id: '', company_person_name: '', notes: '' })
    onSaved()
  }

  const total = parseFloat(form.price) || 0
  const ok = splitsValid()

  return (
    <div className="card" style={{ padding: '1.5rem', alignSelf: 'start' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', marginBottom: '1.25rem' }}>
        Uusi hoitomyynti
      </h3>

      <div className="form-grid">

        {/* Päivämäärä */}
        <div className="input-group">
          <label className="input-label">Päivämäärä</label>
          <input className="input-field" type="date" value={form.visit_date}
            onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))} />
        </div>

        {/* Hoitotuote */}
        <div className="input-group">
          <label className="input-label">Hoitotuote *</label>
          <select className="input-field" value={form.service} onChange={e => selectProduct(e.target.value)}>
            <option value="">Valitse hoitotuote</option>
            {products.map(p => (
              <option key={p.id} value={p.name}>
                {p.name}{p.price > 0 ? ` — ${p.price} €` : ''}
              </option>
            ))}
          </select>
          {products.length === 0 && (
            <span style={{ fontSize: '.72rem', color: 'var(--orange)', marginTop: '.25rem', display: 'block' }}>
              Luo hoitotuotteet Supabaseen (hoitotuotteet-taulu)
            </span>
          )}
        </div>

        {/* Hinta */}
        <div className="input-group">
          <label className="input-label">Hinta (€) *</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '.9rem' }}>€</span>
            <input className="input-field" type="number" step="0.01" min="0" placeholder="0"
              style={{ paddingLeft: '2rem' }}
              value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
          </div>
          {products.find(p => p.name === form.service)?.price > 0 && (
            <span style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.2rem', display: 'block' }}>
              Hinta täyttyy automaattisesti, mutta voit muokata sitä.
            </span>
          )}
        </div>

        {/* Maksutapa */}
        <div className="input-group">
          <label className="input-label">Maksutapa (voit valita useamman)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem', marginTop: '.3rem' }}>
            {MAKSUTAVAT_TERAPIA.map(m => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '.65rem', cursor: 'pointer', fontSize: '.87rem', userSelect: 'none' }}>
                <input type="checkbox" checked={form.payment_methods.includes(m)} onChange={() => togglePayment(m)}
                  style={{ accentColor: 'var(--violet)', width: 16, height: 16, cursor: 'pointer' }} />
                {m}
              </label>
            ))}
          </div>
        </div>

        {/* Split amounts */}
        {form.payment_methods.length >= 2 && (
          <div className="input-group">
            <label className="input-label">Summan jako</label>
            {form.payment_methods.map(m => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.4rem' }}>
                <span style={{ fontSize: '.8rem', color: 'var(--text2)', minWidth: 120 }}>{m}</span>
                <input className="input-field" type="number" step="0.01" min="0" placeholder="0.00"
                  style={{ flex: 1 }}
                  value={form.splits[m] ?? ''}
                  onChange={e => setForm(f => ({ ...f, splits: { ...f.splits, [m]: e.target.value } }))} />
                <span style={{ fontSize: '.8rem', color: 'var(--text3)' }}>€</span>
              </div>
            ))}
            <div style={{ fontSize: '.78rem', fontWeight: 700, color: ok ? 'var(--green)' : 'var(--red)', marginTop: '.25rem' }}>
              Yhteensä: {splitSum().toFixed(2)} € {ok ? '✓' : `≠ ${total.toFixed(2)} €`}
            </div>
            {splitError && (
              <div style={{ fontSize: '.75rem', color: 'var(--red)', marginTop: '.2rem' }}>
                Summien on täsmättävä kokonaishintaan.
              </div>
            )}
          </div>
        )}

        {/* Company + person picker */}
        {needsCompany && (
          <>
            <div className="input-group">
              <label className="input-label">Valitse yritys</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', maxHeight: 160, overflowY: 'auto', background: 'var(--bg2)', borderRadius: 6, padding: '.5rem .75rem', border: '1px solid var(--border)' }}>
                {companies.length === 0
                  ? <span style={{ fontSize: '.78rem', color: 'var(--text3)' }}>Ei yrityksiä.</span>
                  : companies.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', cursor: 'pointer', fontSize: '.85rem', padding: '.15rem 0' }}>
                      <input type="radio" name="sel_company" checked={form.company_id === c.id}
                        onChange={() => selectCompany(c.id, c.name)} style={{ accentColor: 'var(--violet)' }} />
                      {c.name}
                    </label>
                  ))
                }
              </div>
            </div>

            {form.company_id && (
              <div className="input-group">
                <label className="input-label">Valitse henkilö</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', maxHeight: 200, overflowY: 'auto', background: 'var(--bg2)', borderRadius: 6, padding: '.5rem .75rem', border: '1px solid var(--border)' }}>
                  {persons.length === 0
                    ? <span style={{ fontSize: '.78rem', color: 'var(--text3)' }}>Ei henkilöitä. Lisää Yritykset-sivulla.</span>
                    : persons.map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', cursor: 'pointer', fontSize: '.85rem', padding: '.15rem 0' }}>
                        <input type="radio" name="sel_person" checked={form.company_person_id === p.id}
                          onChange={() => selectPerson(p)} style={{ accentColor: 'var(--violet)' }} />
                        {p.name}
                      </label>
                    ))
                  }
                </div>
              </div>
            )}
          </>
        )}

        {/* Kuitin tiedot */}
        <div className="input-group">
          <label className="input-label">Kuitin tai maksun tiedot</label>
          <input className="input-field" placeholder="Lisätiedot..."
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ width: '100%', marginTop: '.25rem' }}>
          {saving ? 'Tallennetaan...' : 'Lähetä'}
        </button>
      </div>
    </div>
  )
}

// ─── Simple form (valmennus / jasen) ─────────────────────────────────────────

const emptyValmennus = { customer_name: '', service: VALMENNUS_PALVELUT[0], price: '', payment_method: MAKSUTAVAT[0], notes: '' }
const emptyJasen = { customer_name: '', membership_type: JASENYYSTYYPIT[0], price: '', start_date: '', payment_method: MAKSUTAVAT[0], notes: '' }

function SimpleForm({ tab, form, onChange, onSave, saving }) {
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
    </div>
  )
}

// ─── Main Sales page ──────────────────────────────────────────────────────────

export default function Sales() {
  const [tab, setTab] = useState('terapia')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyValmennus)
  const [saving, setSaving] = useState(false)
  const [todayTotal, setTodayTotal] = useState(0)

  const TABLE_MAP = { valmennus: 'valmennusmyynti', jasen: 'jasenmyynti' }
  const EMPTY_MAP = { valmennus: emptyValmennus, jasen: emptyJasen }

  useEffect(() => {
    if (tab === 'terapia') {
      fetchTerapia()
    } else {
      setForm(EMPTY_MAP[tab])
      setSearch('')
      fetchOther(tab)
    }
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
    const { data } = await supabase.from('terapiamyynti').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    const today = new Date().toISOString().slice(0, 10)
    setTodayTotal((data || []).filter(r => r.created_at?.slice(0, 10) === today).reduce((s, r) => s + (r.price || 0), 0))
    setLoading(false)
  }

  async function fetchOther(t) {
    setLoading(true)
    const { data } = await supabase.from(TABLE_MAP[t]).select('*').order('created_at', { ascending: false })
    setRows(data || [])
    const today = new Date().toISOString().slice(0, 10)
    setTodayTotal((data || []).filter(r => r.created_at?.slice(0, 10) === today).reduce((s, r) => s + (r.price || 0), 0))
    setLoading(false)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    if (!form.customer_name.trim() || !form.price) return
    setSaving(true)
    const t = TABLE_MAP[tab]
    const base = { customer_name: form.customer_name.trim(), price: parseFloat(form.price), payment_method: form.payment_method, notes: form.notes.trim() || null }
    if (tab === 'valmennus') await supabase.from(t).insert({ ...base, service: form.service })
    else await supabase.from(t).insert({ ...base, membership_type: form.membership_type, start_date: form.start_date || null })
    setSaving(false)
    setForm(EMPTY_MAP[tab])
    fetchOther(tab)
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko kirjaus?')) return
    const t = tab === 'terapia' ? 'terapiamyynti' : TABLE_MAP[tab]
    await supabase.from(t).delete().eq('id', id)
    tab === 'terapia' ? fetchTerapia() : fetchOther(tab)
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

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem', alignItems: 'start' }}>

        {tab === 'terapia'
          ? <TerapiaForm onSaved={fetchTerapia} />
          : <SimpleForm tab={tab} form={form} onChange={handleChange} onSave={handleSave} saving={saving} />
        }

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
                {loading
                  ? <tr><td colSpan={tab === 'jasen' ? 8 : 7} className="table-empty">Ladataan...</td></tr>
                  : filtered.length === 0
                    ? <tr><td colSpan={tab === 'jasen' ? 8 : 7} className="table-empty">Ei kirjauksia.</td></tr>
                    : filtered.map(r => (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: '.78rem' }}>
                          {new Date(r.created_at).toLocaleDateString('fi-FI')}
                        </td>
                        <td style={{ fontWeight: 600 }}>{r.customer_name}</td>
                        <td>{tab === 'jasen' ? r.membership_type : r.service}</td>
                        <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{(r.price || 0).toFixed(2)} €</td>
                        {tab === 'jasen' && <td style={{ color: 'var(--text3)' }}>{r.start_date ? new Date(r.start_date).toLocaleDateString('fi-FI') : '—'}</td>}
                        <td style={{ fontSize: '.78rem' }}>{r.payment_method}</td>
                        <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 160 }}>{r.notes || '—'}</td>
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
