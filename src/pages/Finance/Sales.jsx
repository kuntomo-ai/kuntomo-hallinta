import { useEffect, useState } from 'react'
import { Search, Trash2, Camera, ChevronLeft, ChevronRight, Edit2, CheckCircle, Receipt, ExternalLink } from 'lucide-react'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import VoiceMicButton, { parseVoiceTerapia, parseVoiceValmennus } from '../../components/VoiceInput'
import Modal from '../../components/ui/Modal'
import ReceiptModal from '../../components/ReceiptModal'

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'terapia', label: 'Terapiamyynti' },
  { key: 'valmennus', label: 'Valmennusmyynti' },
  { key: 'jasen', label: 'Jäsenmyynti' },
]

const MAKSUTAVAT_TERAPIA = [
  'Maksupääte', 'Käteinen', 'Hyvinvointietu',
  'Yrityslaskutus', 'Yrityskäynti', 'Laskutus', 'Lahjakortti', 'Muu',
]
const COMPANY_METHODS = ['Yrityslaskutus', 'Yrityskäynti']

const VALMENNUS_PALVELUT = ['Jatkuva valmennus', 'Fysiikkavalmennus', 'Harjoitusohjelma', 'Harjoitusohjelman päivitys', 'Inbody mittaus', 'Muu']
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
  const { profile, user } = useAuth()
  const [products, setProducts] = useState([])
  const [companies, setCompanies] = useState([])
  const [persons, setPersons] = useState([])
  const [saving, setSaving] = useState(false)
  const [splitError, setSplitError] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [giftCode, setGiftCode] = useState('')
  const [giftCard, setGiftCard] = useState(null)       // found lahjakortti row
  const [giftNotFound, setGiftNotFound] = useState(false)
  const [giftChecking, setGiftChecking] = useState(false)

  const [form, setForm] = useState({
    visit_date: TODAY,
    service: '',
    price: '',
    payment_methods: [],
    splits: {},
    hve_provider: '',
    muu_details: '',
    notify_admin: 'ei',
    laskutus_laskutettu: 'ei',
    customer_name_free: '',
    company_id: '',
    company_person_id: '',
    company_person_name: '',
    yritys_name: '',
    kuntomo_laskuttaa: 'ei',
    notes: '',
  })

  useEffect(() => {
    supabaseAdmin.from('hoitotuotteet').select('*').eq('active', true).order('sort_order').order('name')
      .then(({ data }) => setProducts(data || []))
    supabaseAdmin.from('companies').select('id, name').order('name')
      .then(({ data }) => setCompanies(data || []))
  }, [])

  const needsCompany = form.payment_methods.includes('Yrityslaskutus')
  const needsYrityskäynti = form.payment_methods.includes('Yrityskäynti')

  function togglePayment(m) {
    setForm(f => {
      const methods = f.payment_methods.includes(m)
        ? f.payment_methods.filter(x => x !== m)
        : [...f.payment_methods, m]
      return {
        ...f,
        payment_methods: methods,
        hve_provider: methods.includes('Hyvinvointietu') ? f.hve_provider : '',
        muu_details: methods.includes('Muu') ? f.muu_details : '',
        notify_admin: methods.includes('Muu') ? f.notify_admin : 'ei',
        laskutus_laskutettu: methods.includes('Laskutus') ? f.laskutus_laskutettu : 'ei',
        company_id: methods.includes('Yrityslaskutus') ? f.company_id : '',
        company_person_id: methods.includes('Yrityslaskutus') ? f.company_person_id : '',
        company_person_name: methods.includes('Yrityslaskutus') ? f.company_person_name : '',
        yritys_name: methods.includes('Yrityskäynti') ? f.yritys_name : '',
        kuntomo_laskuttaa: methods.includes('Yrityskäynti') ? f.kuntomo_laskuttaa : 'ei',
      }
    })
    if (m === 'Lahjakortti') {
      setGiftCode('')
      setGiftCard(null)
      setGiftNotFound(false)
    }
  }

  async function lookupGiftCard(code) {
    if (!code.trim()) { setGiftCard(null); setGiftNotFound(false); return }
    setGiftChecking(true)
    const { data } = await supabaseAdmin.from('lahjakortit').select('*').eq('code', code.trim()).maybeSingle()
    setGiftChecking(false)
    if (!data) {
      setGiftCard(null)
      setGiftNotFound(true)
    } else {
      setGiftCard(data)
      setGiftNotFound(false)
      // Auto-populate split for gift card if multi-payment
      const remaining = data.price - (data.used_amount || 0)
      const saleAmt = parseFloat(form.price) || 0
      if (saleAmt > remaining) {
        setForm(f => ({ ...f, splits: { ...f.splits, Lahjakortti: String(remaining.toFixed(2)) } }))
      }
    }
  }

  function selectProduct(name) {
    const p = products.find(x => x.name === name)
    setForm(f => ({ ...f, service: name, price: p?.price > 0 ? String(p.price) : f.price }))
  }

  async function selectCompany(id, name) {
    setForm(f => ({ ...f, company_id: id, company_person_id: '', company_person_name: '' }))
    const { data } = await supabaseAdmin.from('company_persons').select('*').eq('company_id', id).order('name')
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

  // Lahjakortti insufficient → need 2nd payment method
  const giftCardRemaining = giftCard ? giftCard.price - (giftCard.used_amount || 0) : 0
  const giftCardInsufficient = giftCard && (parseFloat(form.price) || 0) > giftCardRemaining
  const needsSecondPayment = giftCardInsufficient && form.payment_methods.filter(m => m !== 'Lahjakortti').length === 0

  async function handleSubmit() {
    if (!form.service || !form.price || form.payment_methods.length === 0) return
    if (needsCompany && (!form.company_id || !form.company_person_id)) return
    if (needsYrityskäynti && !form.yritys_name.trim()) return
    if (needsSecondPayment) { setSplitError(true); return }
    if (!splitsValid()) { setSplitError(true); return }
    if (form.payment_methods.includes('Lahjakortti') && !giftCode.trim()) {
      setSaveError('Syötä lahjakortin numero tai tilausnumero.')
      return
    }
    setSplitError(false)
    setSaveError('')
    setSaving(true)

    // Store the storage object path (not a URL); display generates short-lived
    // signed URLs server-side via /api/storage/signed-url.
    let receipt_url = null
    if (receipt) {
      const blob = await compressImg(receipt)
      const path = `terapia/${Date.now()}.jpg`
      const { data: upData } = await supabaseAdmin.storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg' })
      if (upData) receipt_url = path
    }

    const paymentStr = form.payment_methods.map(m => {
      if (m === 'Hyvinvointietu' && form.hve_provider) return `Hyvinvointietu (${form.hve_provider})`
      if (m === 'Muu' && form.muu_details) return `Muu: ${form.muu_details}`
      return m
    }).join(', ')
    const customerName = needsYrityskäynti ? form.yritys_name.trim() : (form.company_person_name || form.customer_name_free?.trim() || '—')

    const empName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : null
    // Save per-method splits when there are multiple payment methods so
    // Tilitettävä-summa can apply the discount (−5% HVE, −10% Lahjakortti)
    // only to that portion, not to the whole sale.
    const splitsToSave = form.payment_methods.length > 1
      ? form.payment_methods.reduce((acc, m) => {
          const label = m === 'Hyvinvointietu' && form.hve_provider ? `Hyvinvointietu (${form.hve_provider})` : m
          const amt = parseFloat(form.splits[m])
          if (!isNaN(amt) && amt > 0) acc[label] = amt
          return acc
        }, {})
      : null
    const { error: insertError } = await supabaseAdmin.from('terapiamyynti').insert({
      customer_name: customerName,
      service: form.service,
      price: parseFloat(form.price),
      payment_method: paymentStr,
      splits: splitsToSave,
      notes: form.notes.trim() || null,
      receipt_url,
      employee_id: user?.id ?? null,
      employee_name: empName || null,
      seller_id: user?.id ?? null,
      visit_date: form.visit_date || null,
      entry_date: form.visit_date || null,
      laskutettu: form.payment_methods.includes('Laskutus') ? (form.laskutus_laskutettu === 'kylla') : null,
    })
    if (insertError) {
      setSaveError(insertError.message)
      setSaving(false)
      return
    }

    if (needsCompany && form.company_id && form.company_person_id) {
      // Only the Yrityslaskutus portion is invoiced to the company; other
      // methods (e.g. Maksupääte) are paid at the till and don't belong here.
      const yritysPortion = splitsToSave && splitsToSave['Yrityslaskutus'] != null
        ? parseFloat(splitsToSave['Yrityslaskutus'])
        : parseFloat(form.price)
      await supabaseAdmin.from('company_visits').insert({
        company_id: form.company_id,
        company_person_id: form.company_person_id,
        company_person_name: form.company_person_name,
        visit_date: form.visit_date,
        service: form.service,
        price: yritysPortion,
        payment_type: 'Yrityslaskutus',
        invoiced: false,
        notes: form.notes.trim() || null,
        employee_name: empName || null,
      })
    }

    if (needsYrityskäynti && form.kuntomo_laskuttaa === 'kylla') {
      await supabaseAdmin.from('tasks').insert({
        title: `Yrityskäyntilasku: ${form.yritys_name.trim()}`,
        description: `Palvelu: ${form.service} — ${parseFloat(form.price).toFixed(2)} €. Kirjannut: ${empName || '—'}`,
        status: 'avoin',
        priority: 'normal',
        due_date: null,
        assigned_to: 'admin',
        created_by: empName || 'Järjestelmä',
      })
    }

    if (form.notify_admin === 'kylla') {
      await supabaseAdmin.from('channel_messages').insert({
        content: `🔔 Hoitomyynti-ilmoitus: ${form.service} — ${parseFloat(form.price).toFixed(2)} € (${paymentStr})${form.notes ? '. ' + form.notes : ''}`,
        sender_name: profile?.full_name || profile?.email || 'Järjestelmä',
        sender_id: user?.id || null,
        recipient_type: 'role',
        recipient_role: 'admin',
      })
    }

    if (form.payment_methods.includes('Laskutus') && form.laskutus_laskutettu === 'ei') {
      await supabaseAdmin.from('channel_messages').insert({
        content: `🧾 Laskuttamaton hoitomyynti: ${empName || '—'} — ${form.service} — ${parseFloat(form.price).toFixed(2)} € — ${form.visit_date || TODAY}${form.notes ? '. ' + form.notes : ''}`,
        sender_name: profile?.full_name || profile?.email || 'Järjestelmä',
        sender_id: user?.id || null,
        recipient_type: 'role',
        recipient_role: 'admin',
      })
    }

    // ── Lahjakortti-käsittely (try/catch jotta onSaved() aina kutsutaan) ────────
    try {
      if (form.payment_methods.includes('Lahjakortti') && giftCode.trim()) {
        if (giftNotFound || !giftCard) {
          // Lahjakorttia ei löydy → luo tehtävä adminille (viite voi olla myös tilausnumero)
          await supabaseAdmin.from('tasks').insert({
            title: `Lahjakortti/tilausnumero ${giftCode.trim()} ei löydy järjestelmästä`,
            description: `Hoitomyynnissä käytetty lahjakortin numero tai tilausnumero "${giftCode.trim()}" ei löydy järjestelmästä. Palvelu: ${form.service} — ${parseFloat(form.price).toFixed(2)} €. Kirjannut: ${empName || '—'}`,
            status: 'avoin',
            priority: 'high',
            assigned_to: 'admin',
            created_by: empName || 'Järjestelmä',
          })
        } else {
          // Lahjakortti löytyi → veloita ja lisää muistiinpano
          const saleAmt = parseFloat(form.price) || 0
          const remaining = giftCard.price - (giftCard.used_amount || 0)
          const deduct = Math.min(saleAmt, remaining)
          const newUsed = (giftCard.used_amount || 0) + deduct
          const dateStr = new Date().toLocaleDateString('fi-FI')
          const noteEntry = `${dateStr}: ${deduct.toFixed(2)} € käytetty (${form.service})`
          const newNotes = giftCard.notes ? `${giftCard.notes}\n${noteEntry}` : noteEntry
          await supabaseAdmin.from('lahjakortit').update({
            used_amount: newUsed,
            notes: newNotes,
          }).eq('id', giftCard.id)
        }
      }
    } catch (e) {
      console.error('Lahjakortti-käsittely epäonnistui:', e)
    }

    setSaving(false)
    setReceipt(null)
    setGiftCode('')
    setGiftCard(null)
    setGiftNotFound(false)
    setForm({ visit_date: TODAY, service: '', price: '', payment_methods: [], splits: {}, hve_provider: '', muu_details: '', notify_admin: 'ei', laskutus_laskutettu: 'ei', customer_name_free: '', company_id: '', company_person_id: '', company_person_name: '', yritys_name: '', kuntomo_laskuttaa: 'ei', notes: '' })
    onSaved()
  }

  const total = parseFloat(form.price) || 0
  const ok = splitsValid()

  return (
    <div className="card" style={{ padding: '1rem', alignSelf: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>
          Uusi hoitomyynti
        </h3>
        <VoiceMicButton label="Puhekirjaus" onResult={text => {
          const parsed = parseVoiceTerapia(text, products)
          setForm(f => ({
            ...f,
            ...parsed,
            payment_methods: parsed.payment_methods || f.payment_methods,
          }))
        }} />
      </div>

      <div className="form-grid" style={{ gap: '.6rem' }}>

        {/* Päivämäärä + Hinta vierekkäin */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label">Päivämäärä</label>
            <input className="input-field" type="date" value={form.visit_date}
              onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))} />
          </div>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label">Hinta (€) *</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '.9rem' }}>€</span>
              <input className="input-field" type="number" step="0.01" min="0" placeholder="0"
                style={{ paddingLeft: '2rem' }}
                value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            </div>
          </div>
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

        {/* Maksutapa */}
        <div className="input-group">
          <label className="input-label">Maksutapa (voit valita useamman)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '.3rem', marginTop: '.3rem' }}>
            {MAKSUTAVAT_TERAPIA.map(m => {
              const hasOpenPanel =
                (m === 'Hyvinvointietu' && form.payment_methods.includes('Hyvinvointietu')) ||
                (m === 'Lahjakortti'    && form.payment_methods.includes('Lahjakortti'))    ||
                (m === 'Laskutus'       && form.payment_methods.includes('Laskutus'))       ||
                (m === 'Muu'            && form.payment_methods.includes('Muu'))
              return (
              <div key={m} style={hasOpenPanel ? { gridColumn: '1 / -1' } : undefined}>
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
                {m === 'Lahjakortti' && form.payment_methods.includes('Lahjakortti') && (
                  <div style={{ marginLeft: '1.65rem', marginTop: '.5rem', padding: '.75rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label className="input-label">Lahjakortin numero tai tilausnumero *</label>
                      <input
                        className="input-field"
                        placeholder="Lahjakortin numero tai tilausnumero (pakollinen)"
                        value={giftCode}
                        onChange={e => { setGiftCode(e.target.value); setGiftCard(null); setGiftNotFound(false) }}
                        onBlur={() => lookupGiftCard(giftCode)}
                      />
                    </div>
                    {giftChecking && (
                      <div style={{ fontSize: '.78rem', color: 'var(--text3)' }}>Tarkistetaan...</div>
                    )}
                    {giftNotFound && giftCode.trim() && (
                      <div style={{ fontSize: '.78rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '.45rem .7rem', color: 'var(--red)' }}>
                        ⚠️ <strong>{giftCode.trim()}</strong> ei löydy järjestelmästä. Tarkista että numero on oikein, tai jätä tilausnumero
                        (esim. verkkokaupan tilausnro) kenttään — se tallennetaan viitteeksi ja Admin saa tehtävän tarkistettavaksi.
                      </div>
                    )}
                    {giftCard && (() => {
                      const remaining = giftCard.price - (giftCard.used_amount || 0)
                      const saleAmt = parseFloat(form.price) || 0
                      const insufficient = saleAmt > remaining
                      return (
                        <div style={{ fontSize: '.78rem', background: insufficient ? '#FFF7ED' : 'var(--green-subtle)', border: `1px solid ${insufficient ? '#FED7AA' : 'var(--green)'}`, borderRadius: 6, padding: '.45rem .7rem' }}>
                          {insufficient ? (
                            <>
                              <div style={{ color: '#C2410C', fontWeight: 700 }}>⚠️ Lahjakortti ei kata koko summaa</div>
                              <div style={{ color: 'var(--text2)', marginTop: '.2rem' }}>
                                Kortin arvo: {giftCard.price?.toFixed(2)} € — käytetty: {(giftCard.used_amount || 0).toFixed(2)} € — <strong>jäljellä: {remaining.toFixed(2)} €</strong>
                              </div>
                              <div style={{ color: 'var(--text2)', marginTop: '.2rem' }}>
                                Valitse alla toinen maksutapa loppusummalle <strong>{(saleAmt - remaining).toFixed(2)} €</strong>.
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ color: 'var(--green)', fontWeight: 700 }}>✓ Lahjakortti löytyi</div>
                              <div style={{ color: 'var(--text2)', marginTop: '.2rem' }}>
                                Jäljellä: {remaining.toFixed(2)} € — veloitetaan: <strong>{saleAmt.toFixed(2)} €</strong> — jää: {(remaining - saleAmt).toFixed(2)} €
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
                {m === 'Laskutus' && form.payment_methods.includes('Laskutus') && (
                  <div style={{ marginLeft: '1.65rem', marginTop: '.5rem', padding: '.8rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    <div>
                      <div className="input-label" style={{ marginBottom: '.2rem' }}>Laskutettu</div>
                      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '.3rem' }}>
                        {[['kylla', 'Kyllä'], ['ei', 'Ei']].map(([v, l]) => (
                          <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontSize: '.85rem', userSelect: 'none' }}>
                            <input type="radio" name="laskutus_laskutettu" value={v}
                              checked={form.laskutus_laskutettu === v}
                              onChange={() => setForm(f => ({ ...f, laskutus_laskutettu: v }))}
                              style={{ accentColor: 'var(--violet)', cursor: 'pointer' }} />
                            {l}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {m === 'Muu' && form.payment_methods.includes('Muu') && (
                  <div style={{ marginLeft: '1.65rem', marginTop: '.5rem', padding: '.8rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label className="input-label">Tarkenna maksutapa (vapaaehtoinen)</label>
                      <input className="input-field" placeholder="Esim. Lasku, Smartum..."
                        value={form.muu_details}
                        onChange={e => setForm(f => ({ ...f, muu_details: e.target.value }))} />
                    </div>
                    <div>
                      <div className="input-label" style={{ marginBottom: '.2rem' }}>Viesti Admin</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginBottom: '.4rem' }}>Lähetetäänkö pääkäyttäjälle ilmoitus tästä hoitomyynnistä?</div>
                      <div style={{ display: 'flex', gap: '1.5rem' }}>
                        {[['kylla', 'Kyllä'], ['ei', 'Ei']].map(([v, l]) => (
                          <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontSize: '.85rem', userSelect: 'none' }}>
                            <input type="radio" name="notify_admin" value={v}
                              checked={form.notify_admin === v}
                              onChange={() => setForm(f => ({ ...f, notify_admin: v }))}
                              style={{ accentColor: 'var(--violet)', cursor: 'pointer' }} />
                            {l}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )
            })}
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
                {needsSecondPayment
                  ? `Lahjakortti kattaa vain ${giftCardRemaining.toFixed(2)} €. Valitse toinen maksutapa loppusummalle.`
                  : 'Summien on täsmättävä kokonaishintaan.'}
              </div>
            )}
          </div>
        )}

        {/* Yrityskäynti: text field + billing radio */}
        {needsYrityskäynti && (
          <>
            <div className="input-group">
              <label className="input-label">Yrityksen nimi *</label>
              <input className="input-field" placeholder="Esim. Yritys Oy"
                value={form.yritys_name}
                onChange={e => setForm(f => ({ ...f, yritys_name: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Kuntomo laskuttaa</label>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '.3rem' }}>
                {[['kylla', 'Kyllä'], ['ei', 'Ei']].map(([v, l]) => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontSize: '.85rem', userSelect: 'none' }}>
                    <input type="radio" name="kuntomo_laskuttaa" value={v}
                      checked={form.kuntomo_laskuttaa === v}
                      onChange={() => setForm(f => ({ ...f, kuntomo_laskuttaa: v }))}
                      style={{ accentColor: 'var(--violet)', cursor: 'pointer' }} />
                    {l}
                  </label>
                ))}
              </div>
              {form.kuntomo_laskuttaa === 'kylla' && (
                <div style={{ marginTop: '.45rem', fontSize: '.75rem', color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.5rem .75rem' }}>
                  Laskutettavasta käynnistä luodaan automaattisesti tehtävä Admin-käyttäjälle.
                </div>
              )}
            </div>
          </>
        )}

        {/* Company + person picker for Yrityslaskutus */}
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

        {/* Asiakkaan nimi */}
        <div className="input-group">
          <label className="input-label">Asiakkaan nimi (valinnainen)</label>
          <input className="input-field" placeholder="Esim. Matti Meikäläinen"
            value={form.customer_name_free || ''} onChange={e => setForm(f => ({ ...f, customer_name_free: e.target.value }))} />
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

        {saveError && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '.6rem .9rem', fontSize: '.82rem', color: 'var(--red)' }}>
            ⚠️ Tallennus epäonnistui: {saveError}
          </div>
        )}
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ width: '100%', marginTop: '.25rem' }}>
          {saving ? 'Tallennetaan...' : 'Lähetä'}
        </button>
      </div>
    </div>
  )
}

// ─── Valmennus form ───────────────────────────────────────────────────────────

function ValmennusForm({ onSaved }) {
  const { profile, user } = useAuth()
  const [form, setForm] = useState({ visit_date: TODAY, customer_name: '', service: '', price: '', payment_method: VALMENNUS_MAKSUTAVAT[0], notes: '', recurring_months: null })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({
      ...f,
      [name]: value,
      ...(name === 'service' && value !== 'Jatkuva valmennus' ? { recurring_months: null } : {}),
    }))
  }

  async function handleSubmit() {
    if (!form.customer_name.trim() || !form.service || !form.price) return
    const isRecurring = form.service === 'Jatkuva valmennus'
    if (isRecurring && !form.recurring_months) return
    setSaving(true)
    setSaveError('')
    const empName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : null
    const base = {
      customer_name: form.customer_name.trim(),
      service: form.service,
      price: parseFloat(form.price),
      payment_method: form.payment_method || null,
      notes: form.notes.trim() || null,
      employee_id: user?.id ?? null,
      employee_name: empName || null,
      seller_id: user?.id ?? null,
      visit_date: form.visit_date || null,
    }

    let error
    if (isRecurring) {
      const months = parseInt(form.recurring_months)
      const now = new Date()
      const records = Array.from({ length: months }, (_, i) => {
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1 + i, 0)
        return { ...base, visit_date: lastDay.toISOString().slice(0, 10) }
      });
      ({ error } = await supabaseAdmin.from('valmennusmyynti').insert(records))
    } else {
      ({ error } = await supabaseAdmin.from('valmennusmyynti').insert(base))
    }

    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setForm({ visit_date: TODAY, customer_name: '', service: '', price: '', payment_method: VALMENNUS_MAKSUTAVAT[0], notes: '', recurring_months: null })
    onSaved()
  }

  return (
    <div className="card" style={{ padding: '1.5rem', alignSelf: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>
          Uusi valmennuskirjaus
        </h3>
        <VoiceMicButton label="Puhekirjaus" onResult={text => {
          const parsed = parseVoiceValmennus(text)
          setForm(f => ({ ...f, ...parsed }))
        }} />
      </div>
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
          <select className="input-field" name="service" value={form.service} onChange={handleChange}>
            <option value="">Valitse palvelu</option>
            {VALMENNUS_PALVELUT.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        {form.service === 'Jatkuva valmennus' && (
          <div className="input-group">
            <label className="input-label">Laskutus jatkuu (kuukausia)</label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              {[1, 2, 3, 4, 5, 6].map(n => (
                <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontWeight: form.recurring_months === String(n) ? 700 : 400 }}>
                  <input type="radio" name="recurring_months" value={n} checked={form.recurring_months === String(n)} onChange={handleChange} />
                  {n} kk
                </label>
              ))}
            </div>
          </div>
        )}
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
  const { profile, user } = useAuth()
  const [form, setForm] = useState({ customer_name: '', customer_email: '', visit_date: TODAY, service: '', price: '', discount_info: '', start_date: '', notes: '' })
  const [saving, setSaving] = useState(false)

  function selectService(name) {
    const p = JASENYYSTUOTTEET.find(x => x.name === name)
    setForm(f => ({ ...f, service: name, price: p ? String(p.price) : f.price }))
  }

  async function handleSubmit() {
    if (!form.customer_name.trim() || !form.service || !form.price) return
    setSaving(true)
    const empName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : null
    const { error: jasenError } = await supabaseAdmin.from('jasenmyynti').insert({
      customer_name: form.customer_name.trim(),
      customer_email: form.customer_email.trim() || null,
      visit_date: form.visit_date || null,
      service: form.service,
      membership_type: form.service,
      price: parseFloat(form.price),
      discount_info: form.discount_info.trim() || null,
      start_date: form.start_date || null,
      notes: form.notes.trim() || null,
      employee_id: user?.id ?? null,
      employee_name: empName || null,
      seller_id: user?.id ?? null,
    })
    setSaving(false)
    if (jasenError) { alert('Tallennus epäonnistui: ' + jasenError.message); return }
    setForm({ customer_name: '', customer_email: '', visit_date: TODAY, service: '', price: '', discount_info: '', start_date: '', notes: '' })
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
          <label className="input-label">Myyntipäivä</label>
          <input className="input-field" type="date" value={form.visit_date}
            onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))} />
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
  const { profile, user } = useAuth()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'hallitus'

  const [tab, setTab] = useState('terapia')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [todayTotal, setTodayTotal] = useState(0)
  const [period, setPeriod] = useState('kuukausi')
  const [navDate, setNavDate] = useState(new Date())
  const [filterUser, setFilterUser] = useState('')
  const [users, setUsers] = useState([])
  const [receiptModal, setReceiptModal] = useState(null)
  const [companyMap, setCompanyMap] = useState(new Map())

  const TABLE_MAP = { valmennus: 'valmennusmyynti', jasen: 'jasenmyynti' }

  useEffect(() => {
    (async () => {
      const { data: companies } = await supabaseAdmin.from('companies').select('id, name')
      const nameById = new Map((companies || []).map(c => [c.id, c.name]))
      const PAGE = 1000
      const all = []
      for (let i = 0; i < 50; i++) {
        const { data } = await supabaseAdmin
          .from('company_visits')
          .select('company_id, company_person_name, visit_date, price')
          .range(i * PAGE, (i + 1) * PAGE - 1)
        if (!data || data.length === 0) break
        all.push(...data)
        if (data.length < PAGE) break
      }
      const map = new Map()
      all.forEach(v => {
        if (!v.company_person_name || !v.visit_date) return
        const key = `${v.visit_date}|${v.company_person_name}|${(v.price ?? 0).toFixed(2)}`
        const name = nameById.get(v.company_id)
        if (name) map.set(key, name)
      })
      setCompanyMap(map)
    })()
  }, [])

  function lookupCompany(r) {
    if (!(r.payment_method || '').includes('Yrityslaskutus')) return null
    const date = (r.visit_date || r.entry_date || r.created_at || '').slice(0, 10)
    const key = `${date}|${r.customer_name}|${(r.price ?? 0).toFixed(2)}`
    return companyMap.get(key) || null
  }

  useEffect(() => {
    setSearch('')
    if (tab === 'terapia') fetchTerapia()
    else fetchOther(tab)
  }, [tab])

  useEffect(() => {
    if (isAdmin) {
      Promise.all([
        supabaseAdmin.from('employees').select('first_name, last_name').eq('status', 'active'),
        supabaseAdmin.from('terapiamyynti').select('employee_name').not('employee_name', 'is', null),
        supabaseAdmin.from('valmennusmyynti').select('employee_name').not('employee_name', 'is', null),
        supabaseAdmin.from('jasenmyynti').select('employee_name').not('employee_name', 'is', null),
      ]).then(([empRes, tRes, vRes, jRes]) => {
        const fromEmp = (empRes.data || []).map(e => ({
          full_name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
          last_name: e.last_name || '',
        })).filter(e => e.full_name)
        const salesNames = [
          ...(tRes.data || []).map(r => r.employee_name),
          ...(vRes.data || []).map(r => r.employee_name),
          ...(jRes.data || []).map(r => r.employee_name),
        ].filter(Boolean)
        const empNames = new Set(fromEmp.map(e => e.full_name))
        const fromSales = salesNames
          .filter(n => !empNames.has(n))
          .map(n => { const parts = n.trim().split(' '); return { full_name: n, last_name: parts.length > 1 ? parts[parts.length - 1] : n } })
        const all = [...fromEmp, ...[...new Map(fromSales.map(e => [e.full_name, e])).values()]]
        all.sort((a, b) => a.last_name.localeCompare(b.last_name, 'fi'))
        setUsers(all.map(e => ({ id: e.full_name, full_name: e.full_name })))
      })
    }
  }, [isAdmin])

  // Paginate to avoid Supabase's 1000-row default limit — terapiamyynti has
  // thousands of rows and older months were silently truncated otherwise.
  async function fetchAllPaginated(baseQueryFactory) {
    const PAGE = 1000
    const all = []
    for (let i = 0; i < 50; i++) {
      const { data } = await baseQueryFactory().range(i * PAGE, (i + 1) * PAGE - 1)
      if (!data || data.length === 0) break
      all.push(...data)
      if (data.length < PAGE) break
    }
    return all
  }

  async function fetchTerapia(activeTab) {
    setLoading(true)
    const data = await fetchAllPaginated(() => {
      let q = supabaseAdmin.from('terapiamyynti').select('*').order('entry_date', { ascending: false })
      if (!isAdmin) q = q.eq('employee_id', user?.id)
      return q
    })
    setRows(data)
    const today = new Date().toISOString().slice(0, 10)
    setTodayTotal(data.filter(r => (r.entry_date || r.created_at || '').slice(0, 10) === today).reduce((s, r) => s + (r.price || 0), 0))
    setLoading(false)
  }

  async function fetchOther(t) {
    setLoading(true)
    const data = await fetchAllPaginated(() => {
      let q = supabaseAdmin.from(TABLE_MAP[t]).select('*').order('created_at', { ascending: false })
      if (!isAdmin) q = q.eq('employee_id', user?.id)
      return q
    })
    setRows(data)
    const today = new Date().toISOString().slice(0, 10)
    setTodayTotal(data.filter(r => (r.visit_date || r.created_at || '').slice(0, 10) === today).reduce((s, r) => s + (r.price || 0), 0))
    setLoading(false)
  }

  function movePeriod(dir) {
    setNavDate(d => {
      const n = new Date(d)
      if (period === 'paiva') n.setDate(n.getDate() + dir)
      else if (period === 'kuukausi') n.setMonth(n.getMonth() + dir)
      else if (period === 'vuosi') n.setFullYear(n.getFullYear() + dir)
      return n
    })
  }

  function periodLabel() {
    if (period === 'paiva') return navDate.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
    if (period === 'kuukausi') return navDate.toLocaleDateString('fi-FI', { month: 'long', year: 'numeric' })
    if (period === 'vuosi') return String(navDate.getFullYear())
    return 'Kaikki'
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko kirjaus?')) return
    const t = tab === 'terapia' ? 'terapiamyynti' : TABLE_MAP[tab]
    await supabaseAdmin.from(t).delete().eq('id', id)
    tab === 'terapia' ? fetchTerapia() : fetchOther(tab)
  }

  async function markLaskutettu(id) {
    await supabaseAdmin.from('terapiamyynti').update({ laskutettu: true }).eq('id', id)
    fetchTerapia()
  }

  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editSplitError, setEditSplitError] = useState('')

  function openEdit(r) {
    setEditRow(r)
    if (tab === 'terapia') {
      // Parse the current payment_method string into method labels for the splits UI.
      // Strip any trailing amounts and the " — details" tail so we get clean labels.
      const methodTokens = (r.payment_method || '')
        .split(/\s+—\s+/)[0]
        .split(/,\s*/)
        .map(t => t.replace(/\s+\d+([.,]\d+)?\s*€\s*$/, '').trim())
        .filter(Boolean)
      const existingSplits = (r.splits && typeof r.splits === 'object' && !Array.isArray(r.splits))
        ? { ...r.splits }
        : {}
      const splitsInit = {}
      methodTokens.forEach(m => {
        const v = existingSplits[m]
        splitsInit[m] = v != null ? String(v) : ''
      })
      setEditForm({
        visit_date: (r.entry_date || r.visit_date || r.created_at || '').slice(0, 10),
        customer_name: r.customer_name || '',
        service: r.service || '',
        price: r.price != null ? String(r.price) : '',
        payment_method: r.payment_method || '',
        notes: r.notes || '',
        laskutettu: r.laskutettu ?? null,
        _methods: methodTokens,
        splits: splitsInit,
      })
    } else if (tab === 'valmennus') {
      setEditForm({
        visit_date: (r.visit_date || r.created_at || '').slice(0, 10),
        customer_name: r.customer_name || '',
        service: r.service || '',
        price: r.price != null ? String(r.price) : '',
        payment_method: r.payment_method || '',
        notes: r.notes || '',
      })
    } else {
      setEditForm({
        customer_name: r.customer_name || '',
        customer_email: r.customer_email || '',
        visit_date: (r.visit_date || r.created_at || '').slice(0, 10),
        membership_type: r.membership_type || r.service || '',
        price: r.price != null ? String(r.price) : '',
        start_date: (r.start_date || '').slice(0, 10),
        notes: r.notes || '',
      })
    }
  }

  async function handleEditSave() {
    if (!editRow) return
    setEditSplitError('')
    let table, payload
    if (tab === 'terapia') {
      table = 'terapiamyynti'
      // Multi-method rows MUST have splits summing to price so the Tilitettävä
      // discount (−5% HVE, −10% Lahjakortti) applies only to that portion.
      const methods = editForm._methods || []
      const price = parseFloat(editForm.price) || 0
      const parsedSplits = {}
      if (methods.length >= 2) {
        let sum = 0
        for (const m of methods) {
          const v = parseFloat(editForm.splits?.[m])
          if (isNaN(v) || v < 0) {
            setEditSplitError(`Anna kaikille maksutavoille summa (${m} puuttuu tai virheellinen).`)
            return
          }
          if (v > 0) parsedSplits[m] = v
          sum += v
        }
        if (Math.abs(sum - price) > 0.01) {
          setEditSplitError(`Erittelyn summa (${sum.toFixed(2)} €) ei täsmää hintaan (${price.toFixed(2)} €).`)
          return
        }
      }
      setEditSaving(true)
      payload = {
        entry_date: editForm.visit_date || null,
        visit_date: editForm.visit_date || null,
        customer_name: editForm.customer_name.trim() || null,
        service: editForm.service || null,
        price,
        payment_method: editForm.payment_method || null,
        splits: methods.length >= 2 ? parsedSplits : null,
        notes: editForm.notes.trim() || null,
        ...((editForm.payment_method || '').includes('Laskutus') ? { laskutettu: editForm.laskutettu ?? false } : {}),
      }
    } else if (tab === 'valmennus') {
      setEditSaving(true)
      table = 'valmennusmyynti'
      payload = {
        visit_date: editForm.visit_date || null,
        customer_name: editForm.customer_name.trim() || null,
        service: editForm.service || null,
        price: parseFloat(editForm.price) || 0,
        payment_method: editForm.payment_method || null,
        notes: editForm.notes.trim() || null,
      }
    } else {
      setEditSaving(true)
      table = 'jasenmyynti'
      payload = {
        customer_name: editForm.customer_name.trim() || null,
        customer_email: editForm.customer_email.trim() || null,
        visit_date: editForm.visit_date || null,
        service: editForm.membership_type || null,
        membership_type: editForm.membership_type || null,
        price: parseFloat(editForm.price) || 0,
        start_date: editForm.start_date || null,
        notes: editForm.notes.trim() || null,
      }
    }
    await supabaseAdmin.from(table).update(payload).eq('id', editRow.id)
    setEditSaving(false)
    setEditRow(null)
    tab === 'terapia' ? fetchTerapia() : fetchOther(tab)
  }

  function rowDate(r) {
    if (tab === 'terapia') return (r.entry_date || r.created_at || '').slice(0, 10)
    if (tab === 'valmennus') return (r.visit_date || r.created_at || '').slice(0, 10)
    return (r.visit_date || r.created_at || '').slice(0, 10)
  }

  const navDateStr = navDate.toISOString().slice(0, 10)
  const filtered = rows.filter(r => {
    if (search && !(r.customer_name?.toLowerCase() ?? '').includes(search.toLowerCase())) return false
    const dateStr = rowDate(r)
    if (period === 'paiva' && dateStr !== navDateStr) return false
    if (period === 'kuukausi' && dateStr.slice(0, 7) !== navDateStr.slice(0, 7)) return false
    if (period === 'vuosi' && dateStr.slice(0, 4) !== navDateStr.slice(0, 4)) return false
    if (filterUser && r.employee_name !== filterUser) return false
    return true
  })
  const filteredTotal = filtered.reduce((s, r) => s + (r.price || 0), 0)

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

      <div className="grid-sidebar-main" style={{ alignItems: 'start' }}>

        {tab === 'terapia' && <TerapiaForm onSaved={fetchTerapia} />}
        {tab === 'valmennus' && <ValmennusForm onSaved={() => fetchOther('valmennus')} />}
        {tab === 'jasen' && <JasenForm onSaved={() => fetchOther('jasen')} />}

        <div>
          {/* Period selector */}
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {[['paiva', 'Päivä'], ['kuukausi', 'Kuukausi'], ['vuosi', 'Vuosi'], ['kaikki', 'Kaikki']].map(([v, l]) => (
              <button key={v} className={`sub-tab${period === v ? ' active' : ''}`}
                onClick={() => setPeriod(v)}
                style={{ fontSize: '.78rem', padding: '.35rem .75rem' }}>
                {l}
              </button>
            ))}
            {period !== 'kaikki' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '.2rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => movePeriod(-1)} style={{ padding: '.25rem .35rem' }}><ChevronLeft size={14} /></button>
                <span style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text2)', minWidth: 90, textAlign: 'center' }}>{periodLabel()}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => movePeriod(1)} style={{ padding: '.25rem .35rem' }}><ChevronRight size={14} /></button>
              </div>
            )}
            {isAdmin && users.length > 0 && (
              <select className="input-field" style={{ width: 'auto', fontSize: '.82rem', padding: '.35rem .6rem', height: 'auto', marginLeft: 'auto' }}
                value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                <option value="">Kaikki myyjät</option>
                {users.map(u => {
                  const name = u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim()
                  return <option key={u.id} value={name}>{name}</option>
                })}
              </select>
            )}
          </div>

          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', marginBottom: '1rem' }}>
            <div className="stat-card">
              <div className="stat-label">Myynti tänään</div>
              <div className="stat-value gold">{todayTotal.toFixed(2)} €</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Jakson myynti</div>
              <div className="stat-value gold">{filteredTotal.toFixed(2)} €</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Kirjauksia</div>
              <div className="stat-value">{filtered.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Keskiarvo / kirjaus</div>
              <div className="stat-value">{filtered.length ? (filteredTotal / filtered.length).toFixed(2) : '0.00'} €</div>
            </div>
          </div>

          {/* Table + breakdown */}
          <div className="grid-main-aside">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.5rem' }}>
                <div className="search-wrap" style={{ flex: 1 }}>
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
                    : filtered.map(r => {
                      const isUnbilled = tab === 'terapia' && (r.payment_method || '').includes('Laskutus') && r.laskutettu === false
                      return (
                      <tr key={r.id} style={isUnbilled ? { background: '#FEF2F2' } : undefined}>
                        <td style={{ whiteSpace: 'nowrap', color: isUnbilled ? '#DC2626' : 'var(--text3)', fontSize: '.78rem' }}>
                          {new Date(rowDate(r)).toLocaleDateString('fi-FI')}
                        </td>
                        <td style={{ fontWeight: 600, color: isUnbilled ? '#DC2626' : undefined }}>
                          {r.customer_name}
                          {tab === 'terapia' && (() => {
                            const c = lookupCompany(r)
                            return c ? <div style={{ fontWeight: 500, color: 'var(--text3)', fontSize: '.72rem' }}>{c}</div> : null
                          })()}
                        </td>
                        <td style={{ color: isUnbilled ? '#DC2626' : undefined }}>{tab === 'jasen' ? r.membership_type : r.service}</td>
                        <td style={{ fontWeight: 700, color: isUnbilled ? '#DC2626' : 'var(--violet)' }}>{(r.price || 0).toFixed(2)} €</td>
                        {tab === 'jasen' && <td style={{ color: 'var(--text3)' }}>{r.start_date ? new Date(r.start_date).toLocaleDateString('fi-FI') : '—'}</td>}
                        <td style={{ fontSize: '.78rem', color: isUnbilled ? '#DC2626' : undefined }}>
                          {r.payment_method}
                          {isUnbilled && <span style={{ marginLeft: '.4rem', fontWeight: 700 }}>· Laskuttamatta</span>}
                        </td>
                        <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 160 }}>{r.notes || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '.3rem' }}>
                            {isUnbilled && (
                              <button className="btn btn-ghost btn-sm" title="Merkitse laskutetuksi"
                                style={{ color: '#16A34A' }}
                                onClick={() => markLaskutettu(r.id)}>
                                <CheckCircle size={13} />
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><Edit2 size={13} /></button>
                            {r.receipt_url && (isAdmin || r.seller_id === user?.id) && (
                              <button className="btn btn-ghost btn-sm" title="Näytä kuitti" style={{ color: 'var(--violet)' }} onClick={() => setReceiptModal(r.receipt_url)}>
                                <Receipt size={13} />
                              </button>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>

          {tab === 'terapia' && filtered.length > 0 && (() => {
            // Apply the discount (−5% Hyvinvointietu, −10% Lahjakortti) only to
            // the portion paid with that method. Uses splits when available;
            // falls back to whole-sale discount for older rows without splits.
            const netForPortion = (method, amount) => {
              const m = method.toLowerCase()
              if (m.includes('käteinen')) return 0
              if (m.includes('lahjakortti')) return amount * 0.90
              if (m.includes('hyvinvointietu')) return amount * 0.95
              return amount
            }
            let brutto = 0, tilitettava = 0
            for (const r of filtered) {
              const price = r.price || 0
              brutto += price
              if (r.splits && typeof r.splits === 'object' && !Array.isArray(r.splits) && Object.keys(r.splits).length > 0) {
                for (const [method, amt] of Object.entries(r.splits)) {
                  tilitettava += netForPortion(method, parseFloat(amt) || 0)
                }
                continue
              }
              // No splits recorded. If payment_method lists a single method → apply its rule.
              // If multiple methods (comma-separated) and no split → split evenly as a safer
              // approximation than penalizing -5%/-10% across the entire sale.
              const pmStr = r.payment_method || ''
              const methods = pmStr.split(/\s+—\s+/)[0].split(/,\s*/).map(t => t.trim()).filter(Boolean)
              if (methods.length <= 1) {
                tilitettava += netForPortion(pmStr, price)
              } else {
                const portion = price / methods.length
                for (const m of methods) tilitettava += netForPortion(m, portion)
              }
            }
            return (
              <div style={{ marginTop: '.75rem', padding: '.85rem 1.25rem', background: 'var(--violet-subtle)', border: '1px solid var(--violet-border)', borderRadius: 'var(--radius)', display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '.2rem' }}>Bruttomyynti</div>
                  <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text)' }}>{brutto.toFixed(2)} €</div>
                </div>
                <div>
                  <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '.2rem' }}>Tilitettävä summa</div>
                  <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--violet)' }}>{tilitettava.toFixed(2)} €</div>
                  <div style={{ fontSize: '.62rem', color: 'var(--text3)', marginTop: '.15rem' }}>Käteinen ei sisälly · Lahjakortti −10% · Hyvinvointietu −5%</div>
                </div>
              </div>
            )
          })()}
            </div>

            {/* Palveluittain / Maksutavoittain */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ padding: '1rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.9rem', marginBottom: '.75rem' }}>Palveluittain</h3>
                {(() => {
                  const byService = {}
                  filtered.forEach(r => {
                    const key = r.service || r.membership_type || '—'
                    byService[key] = (byService[key] || 0) + (r.price || 0)
                  })
                  const entries = Object.entries(byService).sort((a, b) => b[1] - a[1])
                  return entries.length === 0
                    ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei dataa.</p>
                    : entries.map(([service, sum]) => (
                      <div key={service} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '.8rem' }}>
                        <span style={{ color: 'var(--text2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{service}</span>
                        <strong style={{ color: 'var(--violet)', flexShrink: 0, marginLeft: '.5rem' }}>{sum.toFixed(2)} €</strong>
                      </div>
                    ))
                })()}
              </div>

              <div className="card" style={{ padding: '1rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.9rem', marginBottom: '.75rem' }}>Maksutavoittain</h3>
                {(() => {
                  const byMethod = {}
                  filtered.forEach(r => {
                    const key = r.payment_method || '—'
                    byMethod[key] = (byMethod[key] || 0) + (r.price || 0)
                  })
                  const entries = Object.entries(byMethod).sort((a, b) => b[1] - a[1])
                  return entries.length === 0
                    ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei dataa.</p>
                    : entries.map(([method, sum]) => (
                      <div key={method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '.8rem' }}>
                        <span style={{ color: 'var(--text2)' }}>{method}</span>
                        <strong style={{ color: 'var(--violet)' }}>{sum.toFixed(2)} €</strong>
                      </div>
                    ))
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {editRow && (
        <Modal
          title="Muokkaa kirjausta"
          onClose={() => setEditRow(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditRow(null)}>Peruuta</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? 'Tallennetaan...' : 'Tallenna'}
              </button>
            </>
          }
        >
          <div className="form-grid">
            {tab !== 'jasen' && (
              <div className="input-group">
                <label className="input-label">Päivämäärä</label>
                <input className="input-field" type="date" value={editForm.visit_date}
                  onChange={e => setEditForm(f => ({ ...f, visit_date: e.target.value }))} />
              </div>
            )}
            <div className="input-group">
              <label className="input-label">Asiakas</label>
              <input className="input-field" value={editForm.customer_name}
                onChange={e => setEditForm(f => ({ ...f, customer_name: e.target.value }))} />
            </div>
            {tab === 'jasen' && (
              <div className="input-group">
                <label className="input-label">Email</label>
                <input className="input-field" type="email" value={editForm.customer_email}
                  onChange={e => setEditForm(f => ({ ...f, customer_email: e.target.value }))} />
              </div>
            )}
            <div className="input-group">
              <label className="input-label">{tab === 'jasen' ? 'Jäsenyystyyppi' : 'Palvelu'}</label>
              {tab === 'jasen' ? (
                <select className="input-field" value={editForm.membership_type}
                  onChange={e => setEditForm(f => ({ ...f, membership_type: e.target.value }))}>
                  <option value="">Valitse</option>
                  {JASENYYSTUOTTEET.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              ) : tab === 'valmennus' ? (
                <select className="input-field" value={editForm.service}
                  onChange={e => setEditForm(f => ({ ...f, service: e.target.value }))}>
                  <option value="">Valitse</option>
                  {VALMENNUS_PALVELUT.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <input className="input-field" value={editForm.service}
                  onChange={e => setEditForm(f => ({ ...f, service: e.target.value }))} />
              )}
            </div>
            <div className="input-group">
              <label className="input-label">Hinta (€)</label>
              <input className="input-field" type="number" step="0.01" min="0" value={editForm.price}
                onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
            </div>
            {tab !== 'jasen' && (
              <div className="input-group">
                <label className="input-label">Maksutapa</label>
                {tab === 'valmennus' ? (
                  <select className="input-field" value={editForm.payment_method}
                    onChange={e => setEditForm(f => ({ ...f, payment_method: e.target.value }))}>
                    {VALMENNUS_MAKSUTAVAT.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input className="input-field" value={editForm.payment_method}
                    onChange={e => setEditForm(f => ({ ...f, payment_method: e.target.value }))} />
                )}
              </div>
            )}
            {tab === 'terapia' && (editForm._methods?.length || 0) >= 2 && (() => {
              const methods = editForm._methods
              const sum = methods.reduce((s, m) => s + (parseFloat(editForm.splits?.[m]) || 0), 0)
              const price = parseFloat(editForm.price) || 0
              const diff = Math.abs(sum - price)
              return (
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label">Erittely maksutavoittain (Tilitettävä-summaa varten)</label>
                  <div style={{ padding: '.75rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    {methods.map(m => (
                      <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                        <span style={{ flex: 1, fontSize: '.87rem', color: 'var(--text2)' }}>{m}</span>
                        <input className="input-field" type="number" step="0.01" min="0" style={{ width: 110 }}
                          value={editForm.splits?.[m] ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, splits: { ...f.splits, [m]: e.target.value } }))} />
                        <span style={{ color: 'var(--text3)', fontSize: '.83rem' }}>€</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '.5rem', fontSize: '.83rem' }}>
                      <span style={{ color: 'var(--text3)' }}>Yhteensä syötetty: <strong style={{ color: diff < 0.01 ? 'var(--green)' : 'var(--orange)' }}>{sum.toFixed(2)} €</strong></span>
                      <span style={{ color: 'var(--text3)' }}>Hinta: {price.toFixed(2)} €</span>
                    </div>
                    {diff >= 0.01 && (
                      <div style={{ fontSize: '.72rem', color: 'var(--orange)' }}>
                        Summan on täsmättävä hintaan tallennusta varten.
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
            {editSplitError && (
              <div style={{ gridColumn: '1 / -1', color: 'var(--orange)', background: 'var(--orange-subtle)', border: '1px solid var(--orange)', padding: '.55rem .75rem', borderRadius: 'var(--radius)', fontSize: '.82rem' }}>
                {editSplitError}
              </div>
            )}
            {tab === 'jasen' && isAdmin && (
              <div className="input-group">
                <label className="input-label">Myyntipäivä</label>
                <input className="input-field" type="date" value={editForm.visit_date || ''}
                  onChange={e => setEditForm(f => ({ ...f, visit_date: e.target.value }))} />
              </div>
            )}
            {tab === 'jasen' && (
              <div className="input-group">
                <label className="input-label">Alkaa</label>
                <input className="input-field" type="date" value={editForm.start_date}
                  onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
            )}
            <div className="input-group">
              <label className="input-label">Muistiinpanot</label>
              <textarea className="input-field" rows={2} value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                style={{ resize: 'vertical' }} />
            </div>
          </div>
        </Modal>
      )}

      <ReceiptModal stored={receiptModal} onClose={() => setReceiptModal(null)} />
    </div>
  )
}
