import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import KirjanpitoNav from '../../components/KirjanpitoNav'

// ── Netvisor CSV-tunnistus ja jäsennys ──────────────────────────────────────

function parseNetvisorAmount(v) {
  if (!v) return null
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// Palauttaa { type: 'tulos'|'kassavirta'|null, period, rows: [{label, value}] }
function parseNetvisorCSV(text) {
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim())

  let reportType = null
  let period = null
  const dataRows = []

  for (const line of lines) {
    const parts = line.split(';')
    const key = (parts[0] || '').trim()
    const val = (parts[1] || '').trim()

    if (key === 'Kirjanpitoraportin tyyppi') {
      if (val.toLowerCase().includes('tulos')) reportType = 'tulos'
      else if (val.toLowerCase().includes('kassavirta')) reportType = 'kassavirta'
    }

    if (key === 'Tositepvm' && val.includes(' - ')) {
      // "01.05.2025 - 31.05.2025" → period = "2025-05"
      const match = val.match(/(\d{2})\.(\d{2})\.(\d{4})\s*-\s*(\d{2})\.(\d{2})\.(\d{4})/)
      if (match) {
        period = `${match[6]}-${match[5].padStart(2, '0')}`
      }
    }

    // Datasarakkeet: Key;Value (skip header/meta rows)
    const amount = parseNetvisorAmount(val)
    if (amount !== null && key && key !== 'Kirjanpitoraportin tyyppi' && key !== 'Tositepvm') {
      dataRows.push({ label: key, value: amount })
    }
  }

  return { reportType, period, dataRows }
}

// Netvisor tuloslaskelma label → tulos_kuukausiraportti kenttä
const TULOS_MAP = [
  { field: 'liikevaihto',                  patterns: ['liikevaihto'] },
  { field: 'materiaalit_palvelut',          patterns: ['materiaalit ja palvelut', 'materiaalit, tarvikkeet ja tavarat', 'ulkopuoliset palvelut', 'materiaalit'] },
  { field: 'henkilostokulut',               patterns: ['henkilöstökulut', 'henkilostokulut', 'palkat ja palkkiot', 'palkat'] },
  { field: 'liiketoiminnan_muut_kulut',     patterns: ['liiketoiminnan muut kulut', 'muut kulut'] },
  { field: 'liikevoitto',                   patterns: ['liikevoitto/-tappio', 'liikevoitto', 'liikevoitto / -tappio'] },
  { field: 'rahoituskulut',                 patterns: ['rahoitustuotot ja -kulut', 'rahoitustuotot ja kulut', 'rahoituskulut', 'korkokulut'] },
  { field: 'tilikauden_voitto',             patterns: ['tilikauden voitto/tappio', 'tilikauden voitto', 'tilikauden tulos', 'voitto ennen veroja', 'tulos ennen veroja'] },
]

function mapToTulosRow(dataRows, period) {
  const row = { period }
  for (const { field, patterns } of TULOS_MAP) {
    const match = dataRows.find(r =>
      patterns.some(p => r.label.toLowerCase().includes(p.toLowerCase()))
    )
    if (match) row[field] = match.value
  }
  return row
}

// ── Pääkomponentti ─────────────────────────────────────────────────────────

export default function KirjanpitoTuonti() {
  const [status, setStatus] = useState('idle') // idle | importing | done | error
  const [result, setResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileRef = useRef()

  async function handleFile(file) {
    if (!file) return
    setFileName(file.name)
    setStatus('importing')
    setResult(null)

    const tryParse = (encoding) => new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsText(file, encoding)
    })

    let text
    try {
      // Kokeile ensin latin-1 (Netvisor-oletusenkoodaus), sitten UTF-8
      text = await tryParse('windows-1252')
    } catch {
      text = await tryParse('UTF-8')
    }

    const { reportType, period, dataRows } = parseNetvisorCSV(text)

    if (!reportType) {
      // Ei tunnistettu Netvisor-formaatiksi – yritä UTF-8
      const text2 = await tryParse('UTF-8')
      const parsed2 = parseNetvisorCSV(text2)
      if (!parsed2.reportType) {
        setResult({ ok: false, message: 'Tiedostoa ei tunnistettu Netvisor-CSV-formaatiksi. Varmista, että tiedosto on Netvisor-tuloslaskelma tai -kassavirta.' })
        setStatus('error')
        return
      }
      Object.assign({ reportType, period, dataRows }, parsed2)
    }

    if (!period) {
      setResult({ ok: false, message: 'Jakson päivämäärää ei löydetty. Varmista, että CSV sisältää Tositepvm-rivin.' })
      setStatus('error')
      return
    }

    if (reportType === 'tulos') {
      const row = mapToTulosRow(dataRows, period)

      const { error } = await supabase
        .from('tulos_kuukausiraportti')
        .upsert(row, { onConflict: 'period' })

      if (error) {
        setResult({ ok: false, message: `Tallennus epäonnistui: ${error.message}` })
        setStatus('error')
      } else {
        const monthLabel = new Date(period + '-01').toLocaleDateString('fi-FI', { month: 'long', year: 'numeric' })
        setResult({ ok: true, message: `Tuloslaskelma (${monthLabel}) tallennettu.`, fields: Object.keys(row).filter(k => k !== 'period'), period })
        setStatus('done')
      }
    } else {
      setResult({ ok: false, message: `Kassavirta-CSV-tuontia ei ole vielä toteutettu automaattisesti.` })
      setStatus('error')
    }
  }

  function onFileChange(e) { handleFile(e.target.files[0]) }
  function onDrop(e) { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }
  function reset() { setStatus('idle'); setResult(null); setFileName(''); if (fileRef.current) fileRef.current.value = '' }

  return (
    <div>
      <KirjanpitoNav />

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Tuo CSV</h1>
          <p className="page-subtitle">Tuo Netvisor-tuloslaskelma suoraan kannasta</p>
        </div>
      </div>

      {(status === 'idle' || status === 'importing') && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => status !== 'importing' && fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--violet)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              padding: '3rem 1rem',
              textAlign: 'center',
              cursor: status === 'importing' ? 'wait' : 'pointer',
              background: dragOver ? 'var(--violet-subtle)' : 'var(--bg2)',
              transition: 'border-color .2s, background .2s',
            }}
          >
            <Upload size={32} style={{ color: 'var(--violet)', marginBottom: '1rem' }} />
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '.4rem' }}>
              {status === 'importing' ? `Tuodaan ${fileName}…` : 'Pudota Netvisor-CSV tähän'}
            </div>
            <div style={{ fontSize: '.82rem', color: 'var(--text3)' }}>
              {status === 'importing' ? 'Odota hetki…' : 'tai klikkaa valitaksesi tiedosto · Tuloslaskelma (CSV)'}
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv,.txt" style={{ display: 'none' }} onChange={onFileChange} />
          </div>

          <div style={{ marginTop: '1.25rem', background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '.85rem 1rem', fontSize: '.8rem', color: 'var(--text3)' }}>
            <strong style={{ color: 'var(--text2)' }}>Tuettu formaatti:</strong> Netvisor-tuloslaskelma, erottimet <code>;</code>, enkoodaus Windows-1252 tai UTF-8.<br />
            Tiedosto tallennetaan automaattisesti jakson mukaan (esim. toukokuu 2025). Jos sama jakso on jo kannassa, se päivitetään.
          </div>
        </div>
      )}

      {status === 'done' && result?.ok && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <CheckCircle size={40} style={{ color: 'var(--green)', marginBottom: '1rem' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem', marginBottom: '.5rem' }}>
            Tuonti onnistui!
          </div>
          <div style={{ color: 'var(--green)', fontWeight: 600, marginBottom: '1.25rem' }}>
            {result.message}
          </div>
          {result.fields?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', justifyContent: 'center', marginBottom: '1.25rem' }}>
              {result.fields.map(f => (
                <span key={f} style={{ background: 'color-mix(in srgb, var(--green) 12%, var(--bg1))', color: 'var(--green)', borderRadius: 4, padding: '2px 10px', fontSize: '.75rem', fontWeight: 600 }}>
                  {f}
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center' }}>
            <button className="btn btn-ghost" onClick={reset}>Tuo uusi tiedosto</button>
            <a href="/finance/kirjanpito/tulos" className="btn btn-primary">Katso tuloslaskelma →</a>
          </div>
        </div>
      )}

      {status === 'error' && result && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <AlertCircle size={40} style={{ color: 'var(--red)', marginBottom: '1rem' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', marginBottom: '.75rem' }}>
            Tuonti epäonnistui
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '.75rem 1rem', color: 'var(--red)', fontSize: '.85rem', marginBottom: '1.25rem', textAlign: 'left' }}>
            {result.message}
          </div>
          <button className="btn btn-ghost" onClick={reset}>Yritä uudelleen</button>
        </div>
      )}
    </div>
  )
}
