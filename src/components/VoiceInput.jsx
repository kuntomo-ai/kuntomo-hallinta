import { useState, useRef } from 'react'
import { Mic, MicOff } from 'lucide-react'

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoice(onFinal) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recRef = useRef(null)

  function start() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Rec) { alert('Puheentunnistus vaatii Chrome-selaimen.'); return }
    const rec = new Rec()
    rec.lang = 'fi-FI'
    rec.continuous = false
    rec.interimResults = true
    rec.onresult = e => {
      let interimText = ''
      let finalText = ''
      for (const r of e.results) {
        if (r.isFinal) finalText += r[0].transcript
        else interimText += r[0].transcript
      }
      setInterim(interimText)
      if (finalText) { onFinal(finalText); setInterim('') }
    }
    rec.onend = () => { setListening(false); setInterim('') }
    rec.onerror = () => { setListening(false); setInterim('') }
    rec.start()
    recRef.current = rec
    setListening(true)
  }

  function stop() { recRef.current?.stop() }

  return { listening, interim, start, stop }
}

// ─── Button component ─────────────────────────────────────────────────────────

export default function VoiceMicButton({ onResult, label = 'Puhekirjaus' }) {
  const { listening, interim, start, stop } = useVoice(onResult)

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}>
      <button
        type="button"
        onClick={listening ? stop : start}
        title={listening ? 'Lopeta puhekirjaus' : 'Aloita puhekirjaus'}
        style={{
          display: 'flex', alignItems: 'center', gap: '.4rem',
          background: listening ? '#dc2626' : 'var(--violet-subtle)',
          color: listening ? '#fff' : 'var(--violet)',
          border: `1.5px solid ${listening ? '#dc2626' : 'var(--violet-border)'}`,
          borderRadius: 'var(--radius)', padding: '.35rem .7rem',
          fontSize: '.78rem', fontWeight: 600, cursor: 'pointer',
          transition: 'all .15s',
        }}
      >
        {listening ? <MicOff size={14} /> : <Mic size={14} />}
        {listening ? 'Lopeta' : label}
      </button>
      {interim && (
        <span style={{ fontSize: '.75rem', color: 'var(--text3)', fontStyle: 'italic', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {interim}
        </span>
      )}
    </div>
  )
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

export function parseVoiceTerapia(text, products) {
  const lower = text.toLowerCase()
  const result = {}

  const priceMatch = lower.match(/(\d+(?:[,\.]\d+)?)\s*(?:euroa|euro|€)/)
  if (priceMatch) result.price = priceMatch[1].replace(',', '.')

  if (/maksupääte|kortilla|korttimaksu/.test(lower)) result.payment_methods = ['Maksupääte']
  else if (/käteinen|käteisellä/.test(lower)) result.payment_methods = ['Käteinen']
  else if (/smartum/.test(lower)) { result.payment_methods = ['Hyvinvointietu']; result.hve_provider = 'Smartum' }
  else if (/epassi/.test(lower)) { result.payment_methods = ['Hyvinvointietu']; result.hve_provider = 'Epassi' }
  else if (/edenred/.test(lower)) { result.payment_methods = ['Hyvinvointietu']; result.hve_provider = 'Edenred' }
  else if (/hyvinvointietu/.test(lower)) result.payment_methods = ['Hyvinvointietu']
  else if (/yrityslaskutus|laskutus/.test(lower)) result.payment_methods = ['Yrityslaskutus']
  else if (/yrityskäynti/.test(lower)) result.payment_methods = ['Yrityskäynti']
  else if (/lahjakortti/.test(lower)) result.payment_methods = ['Lahjakortti']

  for (const p of products) {
    if (lower.includes(p.name.toLowerCase())) {
      result.service = p.name
      if (!result.price && p.price > 0) result.price = String(p.price)
      break
    }
  }
  return result
}

export function parseVoiceValmennus(text) {
  const lower = text.toLowerCase()
  const result = {}

  const priceMatch = lower.match(/(\d+(?:[,\.]\d+)?)\s*(?:euroa|euro|€)/)
  if (priceMatch) result.price = priceMatch[1].replace(',', '.')

  const VALMENNUS_PALVELUT = ['Jatkuva valmennus', 'Fysiikkavalmennus', 'Harjoitusohjelma', 'Harjoitusohjelman päivitys']
  for (const p of VALMENNUS_PALVELUT) {
    if (lower.includes(p.toLowerCase())) { result.service = p; break }
  }

  const VALMENNUS_MAKSUTAVAT = ['Käteinen', 'Kortti', 'Lasku', 'MobilePay', 'Lahjakortti', 'Edenred', 'SmartumPay', 'ePassi']
  for (const m of VALMENNUS_MAKSUTAVAT) {
    if (lower.includes(m.toLowerCase())) { result.payment_method = m; break }
  }

  const nameMatch = lower.match(/asiakas\s+(.+?)(?:\s+\d|$)/)
  if (nameMatch) result.customer_name = nameMatch[1].trim()

  return result
}

export function parseVoiceAjo(text) {
  const lower = text.toLowerCase()
  const result = {}

  const kmMatch = lower.match(/(\d+(?:[,\.]\d+)?)\s*(?:kilometriä|km|kiloa)/)
  if (kmMatch) result.distance_km = kmMatch[1].replace(',', '.')

  const fromMatch = lower.match(/lähtöpaikka\s+(.+?)(?:\s+(?:määränpää|kohde|\d)|$)/)
  if (fromMatch) result.from_location = fromMatch[1].trim()

  const toMatch = lower.match(/(?:määränpää|kohde|menossa)\s+(.+?)(?:\s+\d|$)/)
  if (toMatch) result.to_location = toMatch[1].trim()

  return result
}

export function parseVoiceWorkTime(text) {
  const lower = text.toLowerCase()
  const result = {}

  const startMatch = lower.match(/(?:alku|alkaa|aloitan|töihin)\s+(?:kello\s+)?(\d{1,2}(?:[:.]\d{2})?)/)
  if (startMatch) result.start_time = fmtTime(startMatch[1])

  const endMatch = lower.match(/(?:loppu|loppuu|lopetan)\s+(?:kello\s+)?(\d{1,2}(?:[:.]\d{2})?)/)
  if (endMatch) result.end_time = fmtTime(endMatch[1])

  const breakMatch = lower.match(/tauko\s+(\d+)\s*(?:minuuttia|min)/)
  if (breakMatch) result.break_minutes = breakMatch[1]

  return result
}

function fmtTime(t) {
  if (/[:.]]/.test(t)) {
    const [h, m] = t.split(/[:.]/)
    return `${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}`
  }
  return t.padStart(2, '0') + ':00'
}
