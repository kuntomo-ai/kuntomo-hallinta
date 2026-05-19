import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Mic, MicOff, X } from 'lucide-react'

const PALVELUT_TERAPIA = [
  'Fysioterapia 45min', 'Fysioterapia 60min',
  'OMT erikoisfysioterapia 30min', 'OMT erikoisfysioterapia 45min', 'OMT erikoisfysioterapia 60min',
  'Fasciakäsittely 60min', 'Purentalihasfysioterapia 45min', 'Purentalihasfysioterapia 60min',
  'Äitiysfysioterapia 60min', 'Äitiysfysio ensikäynti 75min', 'Muu',
]
const PALVELUT_VALMENNUS = ['Fysiikkavalmennus', 'Harjoitusohjelma', 'Harjoitusohjelman päivitys', 'Pienryhmä', 'Muu']

function parseNumber(text) {
  const match = text.match(/(\d+[,.]?\d*)/)
  if (!match) return ''
  return match[1].replace(',', '.')
}

function parseName(text) {
  const cleaned = text
    .replace(/asiakkaaksi|asiakkaalle|asiakkaana|asiakas/gi, '')
    .replace(/nimi(ltä|lle|nä|n)?/gi, '')
    .trim()
  const words = cleaned.split(/\s+/).filter(w => w.length > 1)
  if (words.length >= 2) return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return cleaned
}

function parseTerapiaFromTranscript(text) {
  const lower = text.toLowerCase()
  let service = PALVELUT_TERAPIA[0]
  for (const s of PALVELUT_TERAPIA) {
    if (lower.includes(s.toLowerCase().replace(' / ', ' '))) { service = s; break }
  }
  if (lower.includes('omt') || lower.includes('erikois')) service = 'OMT / erikoisfysioterapia 45min'
  if (lower.includes('fascia')) service = 'Fasciakäsittely 60min'
  if (lower.includes('puren') || lower.includes('purenta')) service = 'Purentalihasfysioterapia 45min'
  if (lower.includes('äitiy') || lower.includes('äitiys')) service = 'Äitiysfysioterapia 60min'
  const price = parseNumber(text)
  const nameMatch = text.match(/(?:nimi|asiakas(?:ksi|lle|na)?)[:\s]+([A-ZÄÖÅ][a-zäöå]+ [A-ZÄÖÅ][a-zäöå]+)/i)
  const name = nameMatch ? nameMatch[1] : ''
  return { service, price, customer_name: name }
}

function parseValmennusFromTranscript(text) {
  const lower = text.toLowerCase()
  let service = PALVELUT_VALMENNUS[0]
  for (const s of PALVELUT_VALMENNUS) {
    if (lower.includes(s.toLowerCase())) { service = s; break }
  }
  const price = parseNumber(text)
  const nameMatch = text.match(/(?:nimi|asiakas(?:ksi|lle|na)?)[:\s]+([A-ZÄÖÅ][a-zäöå]+ [A-ZÄÖÅ][a-zäöå]+)/i)
  const name = nameMatch ? nameMatch[1] : ''
  return { service, price, customer_name: name }
}

function parseTimelogFromTranscript(text) {
  const fromMatch = text.match(/(?:lähdöstä|lähtöpaikka|lähdin|lähdetty)[:\s]+([^\s,]+(?:\s[^\s,]+)?)/i)
  const toMatch = text.match(/(?:määränpää|kohde|menin|meni)[:\s]+([^\s,]+(?:\s[^\s,]+)?)/i)
  const km = parseNumber(text)
  return {
    from_location: fromMatch ? fromMatch[1] : '',
    to_location: toMatch ? toMatch[1] : '',
    distance_km: km,
  }
}

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export default function VoiceControl() {
  const location = useLocation()
  const navigate = useNavigate()
  const [listening, setListening] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState({})
  const [context, setContext] = useState('generic')
  const recognitionRef = useRef(null)
  const supported = !!SpeechRecognition

  useEffect(() => {
    if (!supported) return
    const rec = new SpeechRecognition()
    rec.lang = 'fi-FI'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript
      setTranscript(text)
      const path = location.pathname
      if (path.includes('terapiamyynti')) {
        setContext('terapia')
        setParsed(parseTerapiaFromTranscript(text))
      } else if (path.includes('valmennusmyynti')) {
        setContext('valmennus')
        setParsed(parseValmennusFromTranscript(text))
      } else if (path.includes('timelog')) {
        setContext('timelog')
        setParsed(parseTimelogFromTranscript(text))
      } else {
        setContext('generic')
        setParsed({})
      }
      setListening(false)
      setShowResult(true)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
  }, [location.pathname, supported])

  function toggleListen() {
    if (!supported) return
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
    } else {
      setListening(true)
      recognitionRef.current?.start()
    }
  }

  function handleOk() {
    setShowResult(false)
    if (context === 'terapia') {
      if (!location.pathname.includes('terapiamyynti')) navigate('/finance/myynti/terapiamyynti')
      window.dispatchEvent(new CustomEvent('voice-terapia', { detail: parsed }))
    } else if (context === 'valmennus') {
      if (!location.pathname.includes('valmennusmyynti')) navigate('/finance/myynti/valmennusmyynti')
      window.dispatchEvent(new CustomEvent('voice-valmennus', { detail: parsed }))
    } else if (context === 'timelog') {
      if (!location.pathname.includes('timelog')) navigate('/timelog')
      window.dispatchEvent(new CustomEvent('voice-timelog', { detail: parsed }))
    }
  }

  return (
    <>
      <button
        onClick={toggleListen}
        disabled={!supported}
        title={supported ? (listening ? 'Lopeta tallennus' : 'Puhekirjaus') : 'Puheentunnistus ei tuettu tässä selaimessa'}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 18px',
          borderRadius: 28,
          background: listening ? 'var(--red)' : 'var(--violet)',
          color: '#fff',
          border: 'none',
          cursor: supported ? 'pointer' : 'not-allowed',
          opacity: supported ? 1 : 0.4,
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: '.82rem',
          letterSpacing: '.04em',
          boxShadow: listening ? '0 0 0 4px rgba(214,48,49,.25), var(--shadow-lg)' : 'var(--shadow-lg)',
          transition: 'background .2s, box-shadow .2s',
        }}
      >
        {listening ? <MicOff size={16} /> : <Mic size={16} />}
        {listening ? 'Kuuntelee...' : 'Puhekirjaus'}
      </button>

      {showResult && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowResult(false) }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <span className="modal-title">Tunnistettu puhe</span>
              <button className="modal-close" onClick={() => setShowResult(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '.85rem 1rem', marginBottom: '1.25rem', fontSize: '.85rem', color: 'var(--text2)', fontStyle: 'italic' }}>
                "{transcript}"
              </div>

              {context === 'terapia' && (
                <div className="form-grid">
                  <div className="input-group">
                    <label className="input-label">Asiakkaan nimi</label>
                    <input className="input-field" value={parsed.customer_name || ''} onChange={e => setParsed(p => ({ ...p, customer_name: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Palvelu</label>
                    <select className="input-field" value={parsed.service || ''} onChange={e => setParsed(p => ({ ...p, service: e.target.value }))}>
                      {PALVELUT_TERAPIA.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Hinta (€)</label>
                    <input className="input-field" type="number" value={parsed.price || ''} onChange={e => setParsed(p => ({ ...p, price: e.target.value }))} />
                  </div>
                </div>
              )}

              {context === 'valmennus' && (
                <div className="form-grid">
                  <div className="input-group">
                    <label className="input-label">Asiakkaan nimi</label>
                    <input className="input-field" value={parsed.customer_name || ''} onChange={e => setParsed(p => ({ ...p, customer_name: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Palvelu</label>
                    <select className="input-field" value={parsed.service || ''} onChange={e => setParsed(p => ({ ...p, service: e.target.value }))}>
                      {PALVELUT_VALMENNUS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Hinta (€)</label>
                    <input className="input-field" type="number" value={parsed.price || ''} onChange={e => setParsed(p => ({ ...p, price: e.target.value }))} />
                  </div>
                </div>
              )}

              {context === 'timelog' && (
                <div className="form-grid">
                  <div className="form-grid form-grid-2">
                    <div className="input-group">
                      <label className="input-label">Lähtöpaikka</label>
                      <input className="input-field" value={parsed.from_location || ''} onChange={e => setParsed(p => ({ ...p, from_location: e.target.value }))} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Määränpää</label>
                      <input className="input-field" value={parsed.to_location || ''} onChange={e => setParsed(p => ({ ...p, to_location: e.target.value }))} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Matka (km)</label>
                    <input className="input-field" type="number" value={parsed.distance_km || ''} onChange={e => setParsed(p => ({ ...p, distance_km: e.target.value }))} />
                  </div>
                </div>
              )}

              {context === 'generic' && (
                <p style={{ fontSize: '.83rem', color: 'var(--text3)' }}>Siirry oikealle sivulle käyttääksesi puhekirjausta lomakkeen täyttöön.</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowResult(false)}>Sulje</button>
              {context !== 'generic' && (
                <button className="btn btn-primary" onClick={handleOk}>
                  {location.pathname.includes(context === 'terapia' ? 'terapia' : context === 'valmennus' ? 'valmennus' : 'timelog') ? 'Täytä lomake' : 'Siirry sivulle'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
