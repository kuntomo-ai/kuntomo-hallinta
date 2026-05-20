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

const SURVEY_QUESTIONS = [
  { key: 'tyytyväisyys',   label: 'Kuinka tyytyväinen olet tämänhetkiseen työhösi?',  type: 'scale' },
  { key: 'kuormitus',      label: 'Koetko työmääräsi sopivaksi?',                     type: 'scale' },
  { key: 'yhteishenki',    label: 'Miten arvioisit tiimisi yhteishenkeä?',             type: 'scale' },
  { key: 'esimies',        label: 'Saatko riittävästi tukea esihenkilöltäsi?',         type: 'scale' },
  { key: 'suosittelu',     label: 'Suosittelisitko Kuntomoa työnantajana? (0–10)',     type: 'nps' },
  { key: 'palaute',        label: 'Kehitysehdotuksia tai vapaata palautetta',          type: 'text' },
]

const SCALE_LABELS = { 1: 'Heikko', 2: 'Välttävä', 3: 'Kohtalainen', 4: 'Hyvä', 5: 'Erinomainen' }

function ScalePicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{
            width: 44, height: 44, borderRadius: 8, border: '2px solid',
            borderColor: value === n ? 'var(--violet)' : 'var(--border)',
            background: value === n ? 'var(--violet)' : 'var(--bg2)',
            color: value === n ? '#fff' : 'var(--text1)',
            fontWeight: 700, fontSize: '1rem', cursor: 'pointer', transition: 'all .12s',
          }}
        >
          {n}
        </button>
      ))}
      {value && <span style={{ alignSelf: 'center', color: 'var(--text3)', fontSize: '.82rem' }}>{SCALE_LABELS[value]}</span>}
    </div>
  )
}

function NpsPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{
            width: 38, height: 38, borderRadius: 6, border: '2px solid',
            borderColor: value === n ? 'var(--violet)' : 'var(--border)',
            background: value === n ? 'var(--violet)' : 'var(--bg2)',
            color: value === n ? '#fff' : 'var(--text1)',
            fontWeight: 700, fontSize: '.9rem', cursor: 'pointer', transition: 'all .12s',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export default function Surveys() {
  const { profile, isAdmin } = useAuth()
  const [tab, setTab] = useState('henkilosto')
  const [surveyResponses, setSurveyResponses] = useState([])
  const [clothingOrders, setClothingOrders] = useState([])
  const [loading, setLoading] = useState(true)

  // Survey form state
  const emptyAnswers = () => Object.fromEntries(SURVEY_QUESTIONS.map(q => [q.key, q.type === 'text' ? '' : null]))
  const [answers, setAnswers] = useState(emptyAnswers)
  const [respondentName, setRespondentName] = useState('')
  const [surveySaving, setSurveySaving] = useState(false)
  const [surveySaved, setSurveySaved] = useState(false)

  // Clothing order state
  const [clothForm, setClothForm] = useState({ name: '', products: [], size: 'M', notes: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchData()
    const name = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : ''
    setRespondentName(name || profile?.email || '')
    setClothForm(f => ({ ...f, name: name || profile?.email || '' }))
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

  async function handleSurveySubmit() {
    if (!respondentName.trim()) return
    const hasAnswer = SURVEY_QUESTIONS.some(q => q.type === 'text' ? answers[q.key]?.trim() : answers[q.key] != null)
    if (!hasAnswer) return
    setSurveySaving(true)
    await supabase.from('survey_responses').insert({
      respondent_name: respondentName.trim(),
      answers,
    })
    setSurveySaving(false)
    setSurveySaved(true)
    setAnswers(emptyAnswers())
    fetchData()
  }

  function setAnswer(key, val) {
    setAnswers(a => ({ ...a, [key]: val }))
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

  const productCounts = {}
  const sizeCounts = {}
  clothingOrders.forEach(o => {
    (o.products || []).forEach(p => { productCounts[p] = (productCounts[p] || 0) + 1 })
    if (o.size) sizeCounts[o.size] = (sizeCounts[o.size] || 0) + 1
  })

  // Admin summary: average per scale question
  const avgScores = {}
  SURVEY_QUESTIONS.filter(q => q.type === 'scale' || q.type === 'nps').forEach(q => {
    const vals = surveyResponses.map(r => r.answers?.[q.key]).filter(v => v != null)
    avgScores[q.key] = vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : null
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

      {/* ── Henkilöstökysely ─────────────────────────────────────────────────── */}
      {tab === 'henkilosto' && (
        <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* Lomake */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
              Täytä kysely
            </h3>

            {surveySaved && (
              <div style={{ background: 'color-mix(in srgb, var(--green) 12%, var(--bg1))', border: '1px solid var(--green)', borderRadius: 'var(--radius)', padding: '.75rem 1rem', marginBottom: '1rem', color: 'var(--green)', fontWeight: 600, fontSize: '.85rem' }}>
                Vastauksesi on tallennettu — kiitos!
              </div>
            )}

            <div className="form-grid">
              <div className="input-group">
                <label className="input-label">Nimi</label>
                <input className="input-field" value={respondentName} onChange={e => setRespondentName(e.target.value)} placeholder="Etunimi Sukunimi" />
              </div>

              {SURVEY_QUESTIONS.map(q => (
                <div key={q.key} className="input-group">
                  <label className="input-label">{q.label}</label>
                  {q.type === 'scale' && <ScalePicker value={answers[q.key]} onChange={v => setAnswer(q.key, v)} />}
                  {q.type === 'nps' && <NpsPicker value={answers[q.key]} onChange={v => setAnswer(q.key, v)} />}
                  {q.type === 'text' && (
                    <textarea className="input-field" rows={3} value={answers[q.key]} onChange={e => setAnswer(q.key, e.target.value)} style={{ resize: 'vertical' }} />
                  )}
                </div>
              ))}

              <button className="btn btn-primary" onClick={handleSurveySubmit} disabled={surveySaving || !respondentName.trim()}>
                {surveySaving ? 'Tallennetaan...' : 'Lähetä vastaukset'}
              </button>
            </div>
          </div>

          {/* Admin: yhteenveto + vastaukset */}
          {isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="card">
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>
                  Yhteenveto ({surveyResponses.length} vastausta)
                </h3>
                {SURVEY_QUESTIONS.filter(q => q.type !== 'text').map(q => (
                  <div key={q.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.45rem 0', borderBottom: '1px solid var(--border)', fontSize: '.83rem' }}>
                    <span style={{ color: 'var(--text2)', maxWidth: '70%' }}>{q.label.replace(/ \(.*\)/, '')}</span>
                    <strong style={{ color: avgScores[q.key] ? 'var(--violet)' : 'var(--text3)' }}>
                      {avgScores[q.key] ? `⌀ ${avgScores[q.key]}` : '—'}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="card">
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.75rem' }}>Vastaukset</h3>
                {loading ? <div style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ladataan...</div>
                : surveyResponses.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ei vastauksia vielä.</div>
                : surveyResponses.map(r => (
                  <div key={r.id} style={{ padding: '.75rem 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.35rem' }}>
                      <strong style={{ fontSize: '.85rem' }}>{r.respondent_name}</strong>
                      <span style={{ color: 'var(--text3)', fontSize: '.75rem' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</span>
                    </div>
                    {r.answers && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.3rem' }}>
                        {SURVEY_QUESTIONS.map(q => {
                          const v = r.answers[q.key]
                          if (v == null || v === '') return null
                          return (
                            <span key={q.key} style={{ background: 'var(--bg3)', borderRadius: 4, padding: '2px 8px', fontSize: '.72rem', color: 'var(--text2)' }}>
                              {q.key}: <strong>{v}</strong>
                            </span>
                          )
                        })}
                      </div>
                    )}
                    {r.answers?.palaute && (
                      <div style={{ marginTop: '.35rem', fontSize: '.78rem', color: 'var(--text3)', fontStyle: 'italic' }}>
                        "{r.answers.palaute}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Vaatetilaus ─────────────────────────────────────────────────────────── */}
      {tab === 'vaatetus' && (
        <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', marginBottom: '1.25rem' }}>Tee tilaus</h3>
            {saved && (
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
              <button className="btn btn-primary" onClick={handleClothSave} disabled={saving || clothForm.products.length === 0}>
                {saving ? 'Tallennetaan...' : 'Lähetä tilaus'}
              </button>
            </div>
          </div>

          {isAdmin && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', marginBottom: '1.25rem' }}>Yhteenveto (Admin)</h3>
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
    </div>
  )
}
