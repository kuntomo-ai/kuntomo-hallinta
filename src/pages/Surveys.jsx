import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit2, X, GripVertical } from 'lucide-react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'

// ── Vaatetilaus constants ─────────────────────────────────────────────────────
const PRODUCTS = [
  { id: 't-paita', label: 'T-Paita', price: 6 },
  { id: 'collegepaita', label: 'Collegepaita', price: 20 },
  { id: 'huppari', label: 'Huppari', price: 25 },
  { id: 'huppari-vetoketjullinen', label: 'Huppari vetoketjullinen', price: 25 },
]
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

const SCALE5_LABELS = ['', 'Täysin eri mieltä', 'Osittain eri mieltä', 'Ei samaa eikä eri mieltä', 'Osittain samaa mieltä', 'Täysin samaa mieltä']

// ── Question renderers ────────────────────────────────────────────────────────
function Scale5Picker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem', marginTop: '.25rem' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', cursor: 'pointer', fontSize: '.85rem', userSelect: 'none' }}>
          <input type="radio" name={`scale_${Math.random()}`} checked={value === n} onChange={() => onChange(n)}
            style={{ accentColor: 'var(--violet)', width: 16, height: 16, cursor: 'pointer' }} />
          <span style={{ color: value === n ? 'var(--text)' : 'var(--text2)', fontWeight: value === n ? 600 : 400 }}>
            {n}. {SCALE5_LABELS[n]}
          </span>
        </label>
      ))}
    </div>
  )
}

function RadioPicker({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem', marginTop: '.25rem' }}>
      {options.map(opt => (
        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', cursor: 'pointer', fontSize: '.85rem', userSelect: 'none' }}>
          <input type="radio" checked={value === opt} onChange={() => onChange(opt)}
            style={{ accentColor: 'var(--violet)', width: 16, height: 16, cursor: 'pointer' }} />
          <span style={{ color: value === opt ? 'var(--text)' : 'var(--text2)', fontWeight: value === opt ? 600 : 400 }}>{opt}</span>
        </label>
      ))}
    </div>
  )
}

// ── Default config (fallback if Supabase empty) ───────────────────────────────
const DEFAULT_CONFIG = {
  title: 'Kuntomon henkilöstökysely 01-2025',
  description: 'Tällä kyselyllä kartoitetaan Kuntomon henkilöstön ajatuksia. Tavoitteena on hyödyntää niitä kehittämisessä ja yrityksen tulevaisuutta rakennettaessa. Vastauksesi ovat tärkeitä!',
  questions: [
    { key: 'q1',  label: 'Kauanko olet ollut yrityksessä töissä?', type: 'radio', options: ['Alle yhden vuoden', '1-2 vuotta', '2-4 vuotta', 'Enemmän kuin 4 vuotta'] },
    { key: 'q2',  label: 'Työskentelen...', type: 'radio', options: ['Fysioterapeutti', 'Hieroja', 'Valmentaja'] },
    { key: 'q3',  label: 'Mielestäni Kuntomo on tällä hetkellä hyvä työpaikka:', type: 'scale5' },
    { key: 'q4',  label: 'Kerro mitkä asiat tekevät Kuntomon sinulle hyvän työpaikan?', type: 'text' },
    { key: 'q5',  label: 'Minut pidetään ajantasalla yrityksessä tapahtuvista asioissa?', type: 'scale5' },
    { key: 'q6',  label: 'Pystyn vaikuttamaan yrityksen kehittämiseen?', type: 'scale5' },
    { key: 'q7',  label: 'Kehittämisideoitani tavoitellaan säännöllisesti?', type: 'scale5' },
    { key: 'q8',  label: 'Meillä on hyvä yhteishenki yrityksessä?', type: 'scale5' },
    { key: 'q9',  label: 'Esimiestyö on onnistunutta Kuntomossa', type: 'scale5' },
    { key: 'q10', label: 'Johtaminen (toimitusjohtaja) on onnistunutta Kuntomossa', type: 'scale5' },
    { key: 'q11', label: 'Tiedän oman vastuualueeni ja odotukset siitä?', type: 'scale5' },
    { key: 'q12', label: 'Saan työstäni riittävästi palautetta (myönteinen ja kehittymispalaute) johdolta sekä kollegoilta?', type: 'scale5' },
    { key: 'q13', label: 'Uskon yrityksen tulevaisuuteen ja haluan olla mukana siinä pitkään?', type: 'scale5' },
    { key: 'q14', label: 'Olen ylpeä Kuntomosta ja mitä saamme aikaan?', type: 'scale5' },
    { key: 'q15', label: 'Kerro kolme asiaa, joihin Kuntomon tulisi panostaa kehittämisessä? Kerro myös miten, jos mahdollista.', type: 'text' },
    { key: 'q16', label: 'Kuvaile Kuntomon työpaikkaa ja kulttuuria vapaasti?', type: 'text' },
  ],
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Surveys() {
  const { isAdmin, isHallitus } = useAuth()
  const canSeeReport = isAdmin || isHallitus
  const [tab, setTab] = useState('henkilosto')

  // Survey config
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [configId, setConfigId] = useState(null)
  const [configLoading, setConfigLoading] = useState(true)

  // Survey answers
  const emptyAnswers = (qs) => Object.fromEntries((qs || config.questions).map(q => [q.key, q.type === 'text' ? '' : null]))
  const [answers, setAnswers] = useState(() => emptyAnswers(DEFAULT_CONFIG.questions))
  const [surveySaving, setSurveySaving] = useState(false)
  const [surveySaved, setSurveySaved] = useState(false)

  // Survey responses (for report)
  const [responses, setResponses] = useState([])
  const [responsesLoading, setResponsesLoading] = useState(true)

  // Admin edit modal
  const [showEdit, setShowEdit] = useState(false)
  const [editConfig, setEditConfig] = useState(null)
  const [editSaving, setEditSaving] = useState(false)

  // Clothing
  const [clothingOrders, setClothingOrders] = useState([])
  const [clothForm, setClothForm] = useState({ name: '', products: [], size: 'M', notes: '' })
  const [clothSaving, setClothSaving] = useState(false)
  const [clothSaved, setClothSaved] = useState(false)

  useEffect(() => { fetchConfig(); fetchResponses(); fetchClothingOrders() }, [])

  async function fetchConfig() {
    setConfigLoading(true)
    const { data } = await supabaseAdmin.from('survey_config').select('*').order('updated_at', { ascending: false }).limit(1)
    if (data && data.length > 0) {
      const cfg = data[0]
      setConfig({ title: cfg.title, description: cfg.description || '', questions: cfg.questions || [] })
      setConfigId(cfg.id)
      setAnswers(emptyAnswers(cfg.questions || []))
    }
    setConfigLoading(false)
  }

  async function fetchResponses() {
    setResponsesLoading(true)
    const { data } = await supabaseAdmin.from('survey_responses').select('*').order('created_at', { ascending: false })
    setResponses(data || [])
    setResponsesLoading(false)
  }

  async function fetchClothingOrders() {
    const { data } = await supabaseAdmin.from('vaatetilaukset').select('*').order('created_at', { ascending: false })
    setClothingOrders(data || [])
  }

  function setAnswer(key, val) {
    setAnswers(a => ({ ...a, [key]: val }))
  }

  async function handleSurveySubmit() {
    const hasAnswer = config.questions.some(q => q.type === 'text' ? answers[q.key]?.trim() : answers[q.key] != null)
    if (!hasAnswer) return
    setSurveySaving(true)
    await supabaseAdmin.from('survey_responses').insert({ answers })
    setSurveySaving(false)
    setSurveySaved(true)
    setAnswers(emptyAnswers())
    fetchResponses()
  }

  // ── Admin: edit config ──────────────────────────────────────────────────────
  function openEditModal() {
    setEditConfig({
      title: config.title,
      description: config.description,
      questions: config.questions.map(q => ({ ...q, options: q.options ? [...q.options] : [] })),
    })
    setShowEdit(true)
  }

  function updateEditQuestion(idx, field, value) {
    setEditConfig(c => {
      const qs = [...c.questions]
      qs[idx] = { ...qs[idx], [field]: value }
      return { ...c, questions: qs }
    })
  }

  function updateEditOption(qIdx, oIdx, value) {
    setEditConfig(c => {
      const qs = [...c.questions]
      const opts = [...(qs[qIdx].options || [])]
      opts[oIdx] = value
      qs[qIdx] = { ...qs[qIdx], options: opts }
      return { ...c, questions: qs }
    })
  }

  function addOption(qIdx) {
    setEditConfig(c => {
      const qs = [...c.questions]
      qs[qIdx] = { ...qs[qIdx], options: [...(qs[qIdx].options || []), ''] }
      return { ...c, questions: qs }
    })
  }

  function removeOption(qIdx, oIdx) {
    setEditConfig(c => {
      const qs = [...c.questions]
      const opts = [...(qs[qIdx].options || [])]
      opts.splice(oIdx, 1)
      qs[qIdx] = { ...qs[qIdx], options: opts }
      return { ...c, questions: qs }
    })
  }

  function addQuestion() {
    setEditConfig(c => {
      const newKey = `q${Date.now()}`
      return {
        ...c,
        questions: [...c.questions, { key: newKey, label: '', type: 'scale5', options: [] }],
      }
    })
  }

  function removeQuestion(idx) {
    setEditConfig(c => ({ ...c, questions: c.questions.filter((_, i) => i !== idx) }))
  }

  async function saveConfig() {
    setEditSaving(true)
    const payload = { title: editConfig.title, description: editConfig.description, questions: editConfig.questions, updated_at: new Date().toISOString() }
    if (configId) {
      await supabaseAdmin.from('survey_config').update(payload).eq('id', configId)
    } else {
      const { data } = await supabaseAdmin.from('survey_config').insert(payload).select().single()
      if (data) setConfigId(data.id)
    }
    setConfig({ title: editConfig.title, description: editConfig.description || '', questions: editConfig.questions })
    setAnswers(emptyAnswers(editConfig.questions))
    setEditSaving(false)
    setShowEdit(false)
  }

  // ── Clothing handlers ───────────────────────────────────────────────────────
  function toggleProduct(id) {
    setClothForm(f => ({ ...f, products: f.products.includes(id) ? f.products.filter(p => p !== id) : [...f.products, id] }))
  }

  async function handleClothSave() {
    if (!clothForm.name.trim() || clothForm.products.length === 0) return
    setClothSaving(true)
    await supabaseAdmin.from('vaatetilaukset').insert({ name: clothForm.name.trim(), products: clothForm.products, size: clothForm.size, notes: clothForm.notes.trim() || null })
    setClothSaving(false)
    setClothSaved(true)
    setClothForm(f => ({ ...f, products: [], notes: '' }))
    fetchClothingOrders()
  }

  const productCounts = {}
  const sizeCounts = {}
  clothingOrders.forEach(o => {
    ;(o.products || []).forEach(p => { productCounts[p] = (productCounts[p] || 0) + 1 })
    if (o.size) sizeCounts[o.size] = (sizeCounts[o.size] || 0) + 1
  })

  // ── Average scores for scale5 questions ────────────────────────────────────
  const avgScores = {}
  config.questions.filter(q => q.type === 'scale5').forEach(q => {
    const vals = responses.map(r => r.answers?.[q.key]).filter(v => v != null)
    avgScores[q.key] = vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : null
  })

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Kyselyt ja ohjeet</h1>
          <p className="page-subtitle">Henkilöstökyselyt, tilaukset ja henkilökunnan ohjeistus</p>
        </div>
      </div>

      <div className="sub-tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`sub-tab${tab === 'henkilosto' ? ' active' : ''}`} onClick={() => setTab('henkilosto')}>Henkilöstökysely</button>
        <button className={`sub-tab${tab === 'vaatetus' ? ' active' : ''}`} onClick={() => setTab('vaatetus')}>Vaatetilaus</button>
        <button className={`sub-tab${tab === 'ohjeet' ? ' active' : ''}`} onClick={() => setTab('ohjeet')}>Ohjeet</button>
      </div>

      {/* ── Henkilöstökysely ───────────────────────────────────────────────── */}
      {tab === 'henkilosto' && (
        <div>
          {/* Survey header */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.6rem', marginBottom: '.35rem' }}>
                {configLoading ? '...' : config.title}
              </h2>
              {config.description && (
                <p style={{ color: 'var(--text2)', fontSize: '.88rem', maxWidth: 640, lineHeight: 1.5 }}>{config.description}</p>
              )}
            </div>
            {isAdmin && (
              <button className="btn btn-ghost" onClick={openEditModal} style={{ flexShrink: 0 }}>
                <Edit2 size={14} /> Muokkaa kyselyä
              </button>
            )}
          </div>

          <div className="grid-responsive-2" style={{ gridTemplateColumns: canSeeReport ? '1fr 1fr' : '1fr', alignItems: 'start' }}>

            {/* ── Survey form ─────────────────────────────────────────────── */}
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '1.5rem' }}>Täytä kysely</h3>

              {surveySaved ? (
                <div style={{ background: 'color-mix(in srgb, var(--green) 12%, var(--bg1))', border: '1px solid var(--green)', borderRadius: 'var(--radius)', padding: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>✓</div>
                  <div style={{ color: 'var(--green)', fontWeight: 700, fontSize: '1rem' }}>Vastauksesi on tallennettu!</div>
                  <div style={{ color: 'var(--text3)', fontSize: '.82rem', marginTop: '.35rem' }}>Kiitos osallistumisesta.</div>
                  <button className="btn btn-ghost" onClick={() => { setSurveySaved(false); setAnswers(emptyAnswers()) }} style={{ marginTop: '1rem' }}>
                    Vastaa uudelleen
                  </button>
                </div>
              ) : (
                <div className="form-grid">
                  {config.questions.map((q, idx) => (
                    <div key={q.key} className="input-group">
                      <label className="input-label" style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--text)' }}>
                        {idx + 1}. {q.label}
                      </label>
                      {q.type === 'scale5' && (
                        <Scale5Picker value={answers[q.key]} onChange={v => setAnswer(q.key, v)} />
                      )}
                      {q.type === 'radio' && (
                        <RadioPicker value={answers[q.key]} onChange={v => setAnswer(q.key, v)} options={q.options || []} />
                      )}
                      {q.type === 'text' && (
                        <textarea className="input-field" rows={4} value={answers[q.key] || ''} onChange={e => setAnswer(q.key, e.target.value)} style={{ resize: 'vertical' }} />
                      )}
                    </div>
                  ))}

                  <button className="btn btn-primary" onClick={handleSurveySubmit} disabled={surveySaving}>
                    {surveySaving ? 'Tallennetaan...' : 'Lähetä vastaukset'}
                  </button>
                </div>
              )}
            </div>

            {/* ── Report (hallitus + admin only) ──────────────────────────── */}
            {canSeeReport && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Summary stats */}
                <div className="card">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>
                    Yhteenveto — {responses.length} vastausta
                  </h3>
                  {config.questions.filter(q => q.type === 'scale5').map(q => (
                    <div key={q.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '.82rem', gap: '.5rem' }}>
                      <span style={{ color: 'var(--text2)', flex: 1 }}>{q.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexShrink: 0 }}>
                        {avgScores[q.key] && (
                          <div style={{ display: 'flex', gap: 2 }}>
                            {[1,2,3,4,5].map(n => (
                              <div key={n} style={{ width: 6, height: 6, borderRadius: '50%', background: parseFloat(avgScores[q.key]) >= n ? 'var(--violet)' : 'var(--border)' }} />
                            ))}
                          </div>
                        )}
                        <strong style={{ color: avgScores[q.key] ? 'var(--violet)' : 'var(--text3)', minWidth: 28, textAlign: 'right' }}>
                          {avgScores[q.key] ? `${avgScores[q.key]}` : '—'}
                        </strong>
                      </div>
                    </div>
                  ))}
                  {config.questions.filter(q => q.type === 'scale5').length === 0 && (
                    <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei asteikko-kysymyksiä.</p>
                  )}
                </div>

                {/* Radio question distributions */}
                {config.questions.filter(q => q.type === 'radio').map(q => {
                  const counts = {}
                  ;(q.options || []).forEach(o => { counts[o] = 0 })
                  responses.forEach(r => { const v = r.answers?.[q.key]; if (v) counts[v] = (counts[v] || 0) + 1 })
                  return (
                    <div key={q.key} className="card">
                      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.9rem', marginBottom: '.85rem' }}>{q.label}</h3>
                      {Object.entries(counts).map(([opt, count]) => (
                        <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.35rem 0', fontSize: '.82rem' }}>
                          <span style={{ flex: 1, color: 'var(--text2)' }}>{opt}</span>
                          <div style={{ width: 80, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: 'var(--violet)', width: responses.length ? `${(count / responses.length) * 100}%` : '0%', transition: 'width .3s' }} />
                          </div>
                          <strong style={{ minWidth: 20, textAlign: 'right', color: 'var(--text)' }}>{count}</strong>
                        </div>
                      ))}
                    </div>
                  )
                })}

                {/* Individual responses */}
                <div className="card">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.75rem' }}>
                    Vastaukset
                  </h3>
                  {responsesLoading ? (
                    <div style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ladataan...</div>
                  ) : responses.length === 0 ? (
                    <div style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei vastauksia vielä.</div>
                  ) : responses.map((r, ri) => (
                    <div key={r.id} style={{ padding: '.85rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text3)' }}>Vastaaja {responses.length - ri}</span>
                        <span style={{ color: 'var(--text3)', fontSize: '.72rem' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</span>
                      </div>
                      {r.answers && config.questions.map(q => {
                        const v = r.answers[q.key]
                        if (v == null || v === '') return null
                        return (
                          <div key={q.key} style={{ fontSize: '.78rem', marginBottom: '.3rem' }}>
                            <span style={{ color: 'var(--text3)' }}>{q.label.length > 50 ? q.label.slice(0, 48) + '…' : q.label}: </span>
                            {q.type === 'scale5' ? (
                              <strong style={{ color: 'var(--violet)' }}>{v} – {SCALE5_LABELS[v]}</strong>
                            ) : (
                              <span style={{ color: 'var(--text)', fontStyle: q.type === 'text' ? 'italic' : 'normal' }}>{v}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Vaatetilaus ────────────────────────────────────────────────────── */}
      {tab === 'vaatetus' && (
        <div className="grid-responsive-2" style={{ gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', marginBottom: '1.25rem' }}>Tee tilaus</h3>
            {clothSaved && (
              <div style={{ background: 'color-mix(in srgb, var(--green) 12%, var(--bg1))', border: '1px solid var(--green)', borderRadius: 'var(--radius)', padding: '.75rem 1rem', marginBottom: '1rem', color: 'var(--green)', fontWeight: 600, fontSize: '.85rem' }}>
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
              <button className="btn btn-primary" onClick={handleClothSave} disabled={clothSaving || clothForm.products.length === 0}>
                {clothSaving ? 'Tallennetaan...' : 'Lähetä tilaus'}
              </button>
            </div>
          </div>

          {isAdmin && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', marginBottom: '1.25rem' }}>Yhteenveto (Admin)</h3>
              <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1.5rem' }}>
                <div className="stat-card"><div className="stat-label">Tilauksia yhteensä</div><div className="stat-value">{clothingOrders.length}</div></div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '.5rem' }}>Tuotteet</div>
                {Object.entries(productCounts).map(([pid, count]) => {
                  const prod = PRODUCTS.find(p => p.id === pid)
                  return (
                    <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.83rem', padding: '.35rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span>{prod?.label || pid}</span><strong>{count} kpl</strong>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '.5rem' }}>Koot</div>
                {SIZES.filter(s => sizeCounts[s]).map(s => (
                  <div key={s} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.83rem', padding: '.35rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{s}</span><strong>{sizeCounts[s]} kpl</strong>
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

      {/* ── Ohjeet ─────────────────────────────────────────────────────── */}
      {tab === 'ohjeet' && (
        <div style={{ maxWidth: 760 }}>

          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.5rem', marginBottom: '.25rem' }}>Henkilökunnan ohjeistus</h2>
            <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Kuntomo Oy — Sisäinen ohjeistus henkilökunnalle</p>
          </div>

          {/* 1. Arvot */}
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '.75rem', paddingBottom: '.4rem', borderBottom: '2px solid var(--border)' }}>
              Kuntomon arvot
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
              {[
                { nimi: 'REINO', teksti: 'Rehellisyys, kunnioitus ja suvaitsevaisuus' },
                { nimi: 'AINO', teksti: 'Asiakaslähtöinen ja arvojemme mukainen kohtelu' },
                { nimi: 'KUNTO', teksti: 'Kuntomolaiseen henkeen yhdessä liikkuminen ja toisten auttaminen' },
              ].map(arvo => (
                <div key={arvo.nimi} style={{ padding: '.75rem 1rem', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 900, fontSize: '.8rem', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: '.3rem' }}>{arvo.nimi}</div>
                  <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' }}>{arvo.teksti}</div>
                </div>
              ))}
            </div>
            <p style={{ color: 'var(--text2)', lineHeight: 1.65, fontSize: '.9rem' }}>
              Yli kaksi vuosikymmentä sitten Kuntomoon asteli kolme suomalaista kuntoilijaa. Nämä kempeleläiset halusivat muuttaa hyvinvoinnin ja liikunnan käsityksen. Reino, Aino ja Kunto löivät kättä päälle, että heidän elämäntehtävänään on saada ihmiset liikkumaan hymyssä suin, ilolla ja onnella. Tästä alkoi Kuntomon tarina — matka, joka jatkuu edelleen Reinon, Ainon ja Kunnon henkeä noudattaen.
            </p>
          </section>

          {/* 2. Päätöksenteko */}
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '.75rem', paddingBottom: '.4rem', borderBottom: '2px solid var(--border)' }}>
              Päätöksenteko — Kuntomon kolmio
            </h3>
            <p style={{ color: 'var(--text2)', lineHeight: 1.65, fontSize: '.9rem', marginBottom: '.75rem' }}>
              Voit tehdä aina päätöksen itsenäisesti, kunhan Kuntomon kolmio on tasapainossa — eli jokainen hyötyy saman verran.
            </p>
            <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
              {['Työntekijä', 'Asiakas', 'Kuntomo'].map(item => (
                <li key={item} style={{ color: 'var(--text2)', fontSize: '.9rem', lineHeight: 1.55 }}>{item}</li>
              ))}
            </ul>
          </section>

          {/* 3. Hallitus */}
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '.75rem', paddingBottom: '.4rem', borderBottom: '2px solid var(--border)' }}>
              Hallitus
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                {
                  rooli: 'Hallituksen puheenjohtaja',
                  nimi: 'Janne Haverinen',
                  tiedot: 'Kuljetus Haverinen Oy:n omistaja. Yksi Kuntomon omistajista. Osaaminen: myynti, liiketoiminnan kehittäminen. Jussin esimies.',
                },
                {
                  rooli: 'Hallituksen jäsen',
                  nimi: 'Jere Reinikainen',
                  tiedot: 'JR Law omistaja ja lakimies. Yksi Kuntomon omistajista.',
                },
                {
                  rooli: 'Hallituksen sihteeri',
                  nimi: 'Jussi Lotvonen',
                  tiedot: 'Jos et halua tai voi puhua Jussille, ota yhteys Janneen.',
                },
              ].map(h => (
                <div key={h.nimi} style={{ padding: '.75rem 1rem', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', marginBottom: '.2rem' }}>{h.rooli}</div>
                  <div style={{ fontWeight: 700, fontSize: '.95rem', marginBottom: '.3rem' }}>{h.nimi}</div>
                  <div style={{ fontSize: '.83rem', color: 'var(--text2)', lineHeight: 1.5 }}>{h.tiedot}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Tietojärjestelmät */}
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '.75rem', paddingBottom: '.4rem', borderBottom: '2px solid var(--border)' }}>
              Tietojärjestelmät
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
              {[
                {
                  nimi: 'Sähköposti (Gmail)',
                  kuvaus: 'Käyttäjätunnus: etunimi.sukunimi@kuntomo.fi. Salasana toimitetaan erikseen.',
                },
                {
                  nimi: 'AJAS — ajanvarausjärjestelmä',
                  kuvaus: 'Ajanvarausjärjestelmän ohjesivut: ohje.ajas.fi. Ajantasaiset tunnukset saat henkilökunnalta.',
                },
                {
                  nimi: 'WISE ADMIN',
                  kuvaus: 'admin.kuntomo.fi — laskutus ja CRM omilla tunnuksilla.',
                },
              ].map(j => (
                <div key={j.nimi} style={{ padding: '.65rem 1rem', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '.2rem' }}>{j.nimi}</div>
                  <div style={{ fontSize: '.83rem', color: 'var(--text2)', lineHeight: 1.5 }}>{j.kuvaus}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Tiedottaminen */}
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '.75rem', paddingBottom: '.4rem', borderBottom: '2px solid var(--border)' }}>
              Tiedottaminen ja ryhmät
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: '.5rem' }}>WhatsApp-ryhmät</div>
                <ul style={{ paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                  {[
                    ['Kuntomoterapia', 'Koko terapiapuolen ryhmä'],
                    ['Kuntomofysioterapia', 'Fysioterapeuttien oma ryhmä'],
                    ['Kuntomovalmennus', 'Valmentajien oma ryhmä'],
                    ['Kuntomokimppakivaa', 'Koko henkilökunnan ryhmä'],
                  ].map(([nimi, kuvaus]) => (
                    <li key={nimi} style={{ fontSize: '.83rem', color: 'var(--text2)', lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 600 }}>{nimi}</span> — {kuvaus}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: '.5rem' }}>Facebook</div>
                <ul style={{ paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                  {[
                    ['Kuntomohenkilökunta', 'Koko henkilökunnan tiedotuskanava. Sisältää ajantasaiset tiedostot ja tapahtumat.'],
                    ['Kuntomoasiakkaat', 'Asiakkaiden ryhmä — hyvä tiedottaa omista palveluista ja muutoksista.'],
                  ].map(([nimi, kuvaus]) => (
                    <li key={nimi} style={{ fontSize: '.83rem', color: 'var(--text2)', lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 600 }}>{nimi}</span> — {kuvaus}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* 6. Asiakkaan polku */}
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '.75rem', paddingBottom: '.4rem', borderBottom: '2px solid var(--border)' }}>
              Asiakkaan polku Kuntomossa
            </h3>
            <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
              {[
                'Kun asiakas tulee hierontaan ja hänellä on vaiva, johon hieronta ei tehoa tai oireet ovat pitkittyneet — ohjaa hänet fysioterapeutille.',
                'Fysioterapeutin vastaanotolla ft tutkii asiakkaan. Jos asiakas hyötyisi kuntosaliharjoittelusta, ohjataan hänet valmennukseen pt:n tai ft:n kanssa.',
                'Jos asiakas kokee kuntosaliharjoittelun tarpeelliseksi, suosittele pt-pakettia tai yksilövalmennusta. Kohderyhmään soveltuvalle voi suositella myös ft:n vetämää pienryhmää.',
                'Kun asiakkaan tilanne on kartoitettu ja hän on valmis itsenäiseen harjoitteluun, ohjaa hänet kuntosalille tai ryhmäliikuntaan.',
                'Asiakkaalle voi suositella harjoittelun tueksi mentaali- tai hyvinvointivalmennusta.',
                'Asiakas jatkaa hieronnassa käyntiä.',
              ].map((askel, i) => (
                <li key={i} style={{ fontSize: '.88rem', color: 'var(--text2)', lineHeight: 1.6 }}>{askel}</li>
              ))}
            </ol>
          </section>

          {/* 7. Komissio */}
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '.75rem', paddingBottom: '.4rem', borderBottom: '2px solid var(--border)' }}>
              Komissio — Suosittele Kuntomoa, tienaa
            </h3>
            <p style={{ color: 'var(--text2)', lineHeight: 1.65, fontSize: '.9rem', marginBottom: '1rem' }}>
              Kuntomon henkilökunnalla on mahdollisuus ansaita komissiota kuntosalijäsenyyksien hankinnasta. Komissio tilitetään seuraavana palkkapäivänä tai yrittäjille seuraavan laskutuksen yhteydessä.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem', marginBottom: '1rem' }}>
              <div style={{ padding: '.65rem 1rem', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '.2rem' }}>Toistaiseksi voimassaoleva sopimus (yli 6 kk)</div>
                <div style={{ fontSize: '.83rem', color: 'var(--text2)' }}>Komissio = yhden kuukauden maksun suuruinen.</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              <div style={{ fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', marginBottom: '.2rem' }}>Esimerkki</div>
              <div style={{ fontSize: '.83rem', color: 'var(--text2)', lineHeight: 1.6, paddingLeft: '1rem', borderLeft: '3px solid var(--border)' }}>
                Valmentaja tai hieroja puhuu ystävän Kuntomoon, ystävä tekee kuntosalijäsenyyden, asiakashankkija saa yhden kuukauden jäsenyyttä vastaavan summan.
              </div>
            </div>
          </section>

          {/* 8. Asiakaskeskustelut */}
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '.75rem', paddingBottom: '.4rem', borderBottom: '2px solid var(--border)' }}>
              Keskustelut asiakkaan kanssa
            </h3>
            <p style={{ color: 'var(--text2)', lineHeight: 1.65, fontSize: '.9rem', marginBottom: '1rem' }}>
              Pyritään siihen, että asiakkaalta kysytään heti hoitokerran loputtua, haluaako hän varata uuden ajan. Jos haluaa, työntekijä varaa ajan — tätä ei jätetä asiakkaan tehtäväksi.
            </p>
            <p style={{ color: 'var(--text2)', lineHeight: 1.65, fontSize: '.9rem', marginBottom: '.75rem' }}>
              Jos jokainen tekisi hieman myynti- ja markkinointityötä oman tekemisensä ohessa, voisimme yhdessä lisätä myyntiä ja kehittää Kuntomoa. Asiakkaan kanssa voi keskustella esimerkiksi:
            </p>
            <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
              {[
                'Mistä hän sai tietää Kuntomosta',
                'Kuntomon eri toimipisteistä',
                'Kuntomon palvelutarjonnasta',
                'Jos asiakas ei asu Kempeleen alueella — Kuntomon virtuaalitunnit mahdollistavat harjoittelun kotona',
              ].map(item => (
                <li key={item} style={{ fontSize: '.88rem', color: 'var(--text2)', lineHeight: 1.55 }}>{item}</li>
              ))}
            </ul>
          </section>

        </div>
      )}

      {/* ── Admin: Edit survey modal ─────────────────────────────────────── */}
      {showEdit && editConfig && (
        <Modal title="Muokkaa kyselyä" onClose={() => setShowEdit(false)} wide footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={saveConfig} disabled={editSaving}>
              {editSaving ? 'Tallennetaan...' : 'Tallenna kysely'}
            </button>
          </>
        }>
          <div className="form-grid">
            {/* Title */}
            <div className="input-group">
              <label className="input-label">Otsikko</label>
              <input className="input-field" value={editConfig.title} onChange={e => setEditConfig(c => ({ ...c, title: e.target.value }))} placeholder="Kyselyn otsikko" />
            </div>

            {/* Description */}
            <div className="input-group">
              <label className="input-label">Kuvaus / saate</label>
              <textarea className="input-field" rows={3} value={editConfig.description || ''} onChange={e => setEditConfig(c => ({ ...c, description: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>

            {/* Questions */}
            <div>
              <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '.75rem' }}>
                Kysymykset ({editConfig.questions.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {editConfig.questions.map((q, qi) => (
                  <div key={q.key} style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '1rem', border: '1px solid var(--border)', position: 'relative' }}>
                    <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', marginBottom: q.type === 'radio' ? '.75rem' : 0 }}>
                      <span style={{ color: 'var(--text3)', fontSize: '.75rem', fontWeight: 700, paddingTop: '.55rem', minWidth: 20 }}>{qi + 1}.</span>
                      <input
                        className="input-field"
                        style={{ flex: 1, fontSize: '.85rem' }}
                        value={q.label}
                        onChange={e => updateEditQuestion(qi, 'label', e.target.value)}
                        placeholder="Kysymyksen teksti"
                      />
                      <select
                        className="input-field"
                        style={{ width: 120, fontSize: '.78rem', flexShrink: 0 }}
                        value={q.type}
                        onChange={e => updateEditQuestion(qi, 'type', e.target.value)}
                      >
                        <option value="scale5">Asteikko 1–5</option>
                        <option value="radio">Monivalinta</option>
                        <option value="text">Vapaa teksti</option>
                      </select>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ flexShrink: 0 }}
                        onClick={() => removeQuestion(qi)}
                        title="Poista kysymys"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Radio options */}
                    {q.type === 'radio' && (
                      <div style={{ marginLeft: 28, display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                        {(q.options || []).map((opt, oi) => (
                          <div key={oi} style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
                            <input
                              className="input-field"
                              style={{ flex: 1, fontSize: '.78rem', padding: '.3rem .6rem' }}
                              value={opt}
                              onChange={e => updateEditOption(qi, oi, e.target.value)}
                              placeholder={`Vaihtoehto ${oi + 1}`}
                            />
                            <button className="btn btn-ghost btn-sm" onClick={() => removeOption(qi, oi)}><X size={12} /></button>
                          </div>
                        ))}
                        <button className="btn btn-ghost btn-sm" onClick={() => addOption(qi)} style={{ alignSelf: 'flex-start', fontSize: '.75rem' }}>
                          <Plus size={12} /> Lisää vaihtoehto
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button className="btn btn-ghost" onClick={addQuestion} style={{ marginTop: '1rem', width: '100%' }}>
                <Plus size={15} /> Lisää kysymys
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
