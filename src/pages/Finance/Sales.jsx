import { useEffect, useState } from 'react'
import { Search, Trash2, Camera } from 'lucide-react'
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

const VALMENNUS_PALVELUT = ['Jatkuva valmennus', 'Fysiikkavalmennus', 'Harjoitusohjelma', 'Harjoitusohjelman päivitys', 'Muu']
const VALMENNUS_MAKSUTAVAT = ['Käteinen', 'Kortti', 'Lasku', 'MobilePay', 'Lahjakortti', 'Edenred', 'SmartumPay', 'ePassi']
const JASENYYSTUOTTEET = [
  { name: 'Kuntosali', price: 30 },
  { name: 'Päiväjäsenyys', price: 25 },
  { name: '10-x kortti', price: 7.79 },
]

const TODAY = new Date().toISOString().slice(0, 10)

// ─── Image compression util ───────────────────────────────────────────────────

async function compressImg(file) {
  return new Promise(resolve => {
    const img = new Image()
    const blobUrl = URL.createObjectURL(file)
    img.onload = () => {
      const maxW = 1400
      const scale = Math.min(1, maxW / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(blobUrl)
      canvas.toBlob(resolve, 'image/jpeg', 0.72)
    }
    img.src = blobUrl
  })
}

// ─── Terapia form ─────────────────────────────────────────────────────────────

function TerapiaForm({ onSaved }) {
  const [products, setProducts] = useState([])
  const [companies, setCompanies] = useState([])
  const [persons, setPersons] = useState([])
  const [saving, setSaving] = useState(false)
  const [splitError, setSplitError] = useState(false)
  const [receipt, setReceipt] = useState(null)

  const [form, setForm] = useState({
    visit_date: TODAY,
    service: '',
    price: '',
    payment_methods: [],
    splits: {},
    hve_provider: '',
    company_id: '',
    company_person_id: '',
    company_person_name: '',
    notes: '',
  })

  useEffect(() => {
    supabase.from('hoitotuotteet').select('*').eq('active', true).order('sort_order').order('name')
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
        hve_provider: methods.includes('Hyvinvointietu') ? f.hve_provider : '',
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

    let receipt_url = null
    if (receipt) {
      const blob = await compressImg(receipt)
      const path = `terapia/${Date.now()}.jpg`
      const { data: upData } = await supabase.storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg' })
      if (upData) {
        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
        receipt_url = urlData.publicUrl
      }
    }

    const paymentStr = form.payment_methods.map(m =>
      m === 'Hyvinvointietu' && form.hve_provider ? `Hyvinvointietu (${form.hve_provider})` : m
    ).join(', ')
    const customerName = form.company_person_name || '—'

    await supabase.from('terapiamyynti').insert({
      customer_name: customerName,
      service: form.service,
      price: parseFloat(form.price),
      payment_method: paymentStr,
      notes: form.notes.trim() || null,
      receipt_url,
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
    setReceipt(null)
    setForm({ visit_date: TODAY, service: '', price: '', payment_methods: [], splits: {}, hve_provider: '', company_id: '', company_person_id: '', company_person_name: '', notes: '' })
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
            {(() => {
              const cats = [...new Set(products.map(p => p.category || 'Muu'))]
              return cats.map(cat => (
                <optgroup key={cat} label={cat}>
                  {products.filter(p => (p.category || 'Muu') === cat).map(p => (
                    <option key={p.id} value={p.name}>
                      {p.name}{p.price > 0 ? ` — ${p.price} €` : ''}
                    </option>
                  ))}
                </optgroup>
              ))
            })()}
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
              <div key={m}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.65rem', cursor: 'pointer', fontSize: '.87rem', userSelect: 'none' }}>
                  <input type="checkbox" checked={form.payment_methods.includes(m)} onChange={() => togglePayment(m)}
                    style={{ accentColor: 'var(--violet)', width: 16, height: 16, cursor: 'pointer' }} />
                  {m}
                </label>
                {m === 'Hyvinvointietu' && form.payment_methods.includes('Hyvinvointietu') && (
                  <div style={{ display: 'flex', gap: '1rem', marginLeft: '1.65rem', marginTop: '.3rem' }}>
                    {['Smartum', 'Epassi', 'Edenred'].map(p => (
                      <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontSize: '.82rem', userSelect: 'none' }}>
                        <input type="radio" name="hve_provider" value={p}
                          checked={form.hve_provider === p}
                          onChange={() => setForm(f => ({ ...f, hve_provider: p }))}
                          style={{ accentColor: 'var(--violet)', cursor: 'pointer' }} />
                        {p}
                      </label>
                    ))}
                  </div>
                )}
              </div>
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

        {/* Kuitti */}
        <div className="input-group">
          <label className="input-label">Kuitti (valinnainen)</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.6rem', cursor: 'pointer', background: 'var(--bg2)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '.6rem .9rem', fontSize: '.85rem', color: 'var(--text2)' }}>
            <Camera size={15} />
            {receipt ? receipt.name : 'Ota kuva tai valitse tiedosto'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => setReceipt(e.target.files[0] || null)} />
          </label>
          {receipt && (
            <div style={{ marginTop: '.35rem', fontSize: '.72rem', color: 'var(--text3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{(receipt.size / 1024).toFixed(0)} KB → pakataan automaattisesti</span>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: '.72rem', padding: 0 }} onClick={() => setReceipt(null)}>Poista</button>
            </div>
          )}
        </div>

        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ width: '100%', marginTop: '.25rem' }}>
          {saving ? 'Tallennetaan...' : 'Lähetä'}
        </button>
      </div>
    </div>
  )
}

// ─── Valmennus form ───────────────────────────────────────────────────────────

function ValmennusForm({ onSaved }) {
  const [form, setForm] = useState({ visit_date: TODAY, customer_name: '', service: '', price: '', payment_method: VALMENNUS_MAKSUTAVAT[0], notes: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!form.customer_name.trim() || !form.service || !form.price) return
    setSaving(true)
    await supabase.from('valmennusmyynti').insert({
      customer_name: form.customer_name.trim(),
      service: form.service,
      price: parseFloat(form.price),
      payment_method: form.payment_method || null,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    setForm({ visit_date: TODAY, customer_name: '', service: '', price: '', payment_method: VALMENNUS_MAKSUTAVAT[0], notes: '' })
    onSaved()
  }

  return (
    <div className="card" style={{ padding: '1.5rem', alignSelf: 'start' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', marginBottom: '1.25rem' }}>
        Uusi valmennuskirjaus
      </h3>
      <div className="form-grid">
        <div className="input-group">
          <label className="input-label">Päivämäärä</label>
          <input className="input-field" type="date" value={form.visit_date}
            onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))} />
        </div>
        <div className="input-group">
          <label className="input-label">Asiakkaan nimi *</label>
          <input className="input-field" placeholder="Etunimi Sukunimi" value={form.customer_name}
            onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
        </div>
        <div className="input-group">
          <label className="input-label">Palvelu *</label>
          <select className="input-field" value={form.service}
            onChange={e => setForm(f => ({ ...f, service: e.target.value }))}>
            <option value="">Valitse palvelu</option>
            {VALMENNUS_PALVELUT.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Hinta (€) *</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '.9rem' }}>€</span>
            <input className="input-field" type="number" step="0.01" min="0" placeholder="0"
              style={{ paddingLeft: '2rem' }}
              value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
          </div>
        </div>
        <div className="input-group">
          <label className="input-label">Maksutapa</label>
          <select className="input-field" value={form.payment_method}
            onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
            {VALMENNUS_MAKSUTAVAT.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Lisätiedot</label>
          <textarea className="input-field" rows={2} placeholder="Vapaamuotoisia muistiinpanoja..."
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            style={{ resize: 'vertical' }} />
        </div>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ width: '100%', marginTop: '.25rem' }}>
          {saving ? 'Tallennetaan...' : 'Kirjaa myynti'}
        </button>
      </div>
    </div>
  )
}

// ─── Jasen form ───────────────────────────────────────────────────────────────

function JasenForm({ onSaved }) {
  const [form, setForm] = useState({ customer_name: '', customer_email: '', service: '', price: '', discount_info: '', start_date: '', notes: '' })
  const [saving, setSaving] = useState(false)

  function selectService(name) {
    const p = JASENYYSTUOTTEET.find(x => x.name === name)
    setForm(f => ({ ...f, service: name, price: p ? String(p.price) : f.price }))
  }

  async function handleSubmit() {
    if (!form.customer_name.trim() || !form.service || !form.price) return
    setSaving(true)
    await supabase.from('jasenmyynti').insert({
      customer_name: form.customer_name.trim(),
      customer_email: form.customer_email.trim() || null,
      membership_type: form.service,
      price: parseFloat(form.price),
      discount_info: form.discount_info.trim() || null,
      start_date: form.start_date || null,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    setForm({ customer_name: '', customer_email: '', service: '', price: '', discount_info: '', start_date: '', notes: '' })
    onSaved()
  }

  return (
    <div className="card" style={{ padding: '1.5rem', alignSelf: 'start' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', marginBottom: '1.25rem' }}>
        Uusi myynti
      </h3>
      <div className="form-grid">
        <div className="input-group">
          <label className="input-label">Asiakkaan nimi *</label>
          <input className="input-field" placeholder="Etunimi Sukunimi" value={form.customer_name}
            onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
        </div>
        <div className="input-group">
          <label className="input-label">Asiakkaan email</label>
          <input className="input-field" type="email" placeholder="asiakas@email.com" value={form.customer_email}
            onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} />
        </div>
        <div className="input-group">
          <label className="input-label">Palvelu *</label>
          <select className="input-field" value={form.service} onChange={e => selectService(e.target.value)}>
            <option value="">Valitse palvelu</option>
            {JASENYYSTUOTTEET.map(p => (
              <option key={p.name} value={p.name}>{p.name} — {p.price} €</option>
            ))}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Hinta (€) *</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '.9rem' }}>€</span>
            <input className="input-field" type="number" step="0.01" min="0" placeholder="0"
              style={{ paddingLeft: '2rem' }}
              value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
          </div>
          {form.service && <span style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.2rem', display: 'block' }}>Hinta täyttyy automaattisesti, mutta voit muokata sitä.</span>}
        </div>
        <div className="input-group">
          <label className="input-label">Alennuksen sisältö</label>
          <input className="input-field" placeholder="Esim. opiskelija-alennus -10%" value={form.discount_info}
            onChange={e => setForm(f => ({ ...f, discount_info: e.target.value }))} />
        </div>
        <div className="input-group">
          <label className="input-label">Jäsenyyden aloitusaika</label>
          <input className="input-field" type="date" value={form.start_date}
            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
        </div>
        <div className="input-group">
          <label className="input-label">Lisätiedot</label>
          <textarea className="input-field" rows={2} placeholder="Vapaamuotoisia muistiinpanoja..."
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            style={{ resize: 'vertical' }} />
        </div>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ width: '100%', marginTop: '.25rem' }}>
          {saving ? 'Tallennetaan...' : 'Kirjaa myynti'}
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
  const [todayTotal, setTodayTotal] = useState(0)

  const TABLE_MAP = { valmennus: 'valmennusmyynti', jasen: 'jasenmyynti' }

  useEffect(() => {
    setSearch('')
    if (tab === 'terapia') fetchTerapia()
    else fetchOther(tab)
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

        {tab === 'terapia' && <TerapiaForm onSaved={fetchTerapia} />}
        {tab === 'valmennus' && <ValmennusForm onSaved={() => fetchOther('valmennus')} />}
        {tab === 'jasen' && <JasenForm onSaved={() => fetchOther('jasen')} />}

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
