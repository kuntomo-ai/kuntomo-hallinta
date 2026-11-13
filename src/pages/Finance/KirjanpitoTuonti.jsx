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
// Hyväksyy useita sarakemalleja: Netvisor-CSV (key;value), XLSX/PDF jossa luku
// voi olla rivin viimeisessä sarakkeessa ja label koostua useammasta solusta.
function parseNetvisorCSV(text) {
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim())

  let reportType = null
  let period = null
  const dataRows = []

  for (const line of lines) {
    const parts = line.split(';').map(p => p.trim())
    const key = parts[0] || ''

    if (key === 'Kirjanpitoraportin tyyppi') {
      const val = parts[1] || ''
      if (val.toLowerCase().includes('tulos')) reportType = 'tulos'
      else if (val.toLowerCase().includes('kassavirta')) reportType = 'kassavirta'
      continue
    }

    if (key === 'Tositepvm') {
      // "01.05.2025 - 31.05.2025" → period = "2025-05"
      const val = parts.slice(1).join(' ')
      const match = val.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/)
      if (match) period = `${match[6]}-${match[5].padStart(2, '0')}`
      continue
    }

    // Etsi rivin viimeinen numeerinen arvo (tukee useita sarakkeita)
    let amount = null
    let lastNumericIdx = -1
    for (let i = parts.length - 1; i >= 1; i--) {
      const n = parseNetvisorAmount(parts[i])
      if (n !== null) { amount = n; lastNumericIdx = i; break }
    }
    if (amount === null) continue

    // Label = ei-numeeriset solut ennen arvoa, erotettuna välilyönnillä
    const labelParts = parts.slice(0, lastNumericIdx).filter(p => p && parseNetvisorAmount(p) === null)
    const label = labelParts.join(' ').trim()
    if (label) dataRows.push({ label, value: amount })
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

// ── XLSX → teksti ──────────────────────────────────────────────────────────
// Lukee Excel-tiedoston ensimmäisen taulukon ja palauttaa ;-erotellun tekstin
// joka voidaan syöttää parseNetvisorCSV:lle.
async function readXlsxAsText(file) {
  const ExcelJS = (await import('exceljs')).default
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) return ''

  const cellText = v => {
    if (v == null) return ''
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
    if (v instanceof Date) {
      const dd = String(v.getDate()).padStart(2, '0')
      const mm = String(v.getMonth() + 1).padStart(2, '0')
      return `${dd}.${mm}.${v.getFullYear()}`
    }
    if (v.text) return v.text
    if (v.richText) return v.richText.map(r => r.text).join('')
    if (v.result != null) return String(v.result)
    if (v.formula) return ''
    return String(v)
  }

  const lines = []
  sheet.eachRow({ includeEmpty: false }, row => {
    const cells = []
    row.eachCell({ includeEmpty: true }, cell => cells.push(cellText(cell.value).trim()))
    lines.push(cells.join(';'))
  })
  return lines.join('\n')
}

// ── PDF → teksti ───────────────────────────────────────────────────────────
// Ryhmittelee tekstielementit riveiksi y-koordinaatin mukaan ja järjestää
// kunkin rivin solut x-koordinaatin mukaan → ;-eroteltu label;arvo-muoto.
async function readPdfAsText(file) {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise

  const allLines = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const rowMap = new Map()
    for (const item of content.items) {
      if (!item.str) continue
      const y = Math.round(item.transform[5])
      if (!rowMap.has(y)) rowMap.set(y, [])
      rowMap.get(y).push({ x: item.transform[4], text: item.str })
    }
    const ys = [...rowMap.keys()].sort((a, b) => b - a)
    for (const y of ys) {
      const cells = rowMap.get(y).sort((a, b) => a.x - b.x).map(c => c.text.trim()).filter(Boolean)
      if (cells.length) allLines.push(cells.join(';'))
    }
    page.cleanup()
  }
  return allLines.join('\n')
}

const FI_MONTHS = ['tammikuu','helmikuu','maaliskuu','huhtikuu','toukokuu','kesäkuu','heinäkuu','elokuu','syyskuu','lokakuu','marraskuu','joulukuu']

// Täydentää tekstiin "Kirjanpitoraportin tyyppi" -rivin ja mahdollisen
// Tositepvm-rivin jos ne puuttuvat — jolloin ei-CSV lähteet (xlsx/pdf) joissa
// metarivit on taulukon ulkopuolella saadaan silti tunnistetuksi.
// Jos selkeää metariviä ei löydy mutta sisältö näyttää tulos/kassavirralta,
// lisätään synteettinen tyyppirivi.
function enrichParsedText(text, fileName = '') {
  const lower = (text + ' ' + fileName).toLowerCase()
  const extra = []

  if (!/kirjanpitoraportin tyyppi/i.test(text)) {
    const isTulos = /tuloslaske|liikevaihto|tilikauden (voitto|tulos)/i.test(lower)
    const isKassa = /kassavirta/i.test(lower)
    if (isTulos && !isKassa) extra.push('Kirjanpitoraportin tyyppi;tuloslaskelma')
    else if (isKassa) extra.push('Kirjanpitoraportin tyyppi;kassavirta')
  }

  if (!/^tositepvm/im.test(text)) {
    // 1) Päivämääräväli: "01.05.2025 - 31.05.2025" (myös en-dash, yksinumeroiset)
    let range = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/)
    if (range) {
      extra.push(`Tositepvm;${range[0]}`)
    } else {
      // 2) Yksittäinen päivä: "31.05.2025" → oleta kuukauden loppuun
      const single = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/)
      if (single) {
        extra.push(`Tositepvm;01.${single[2].padStart(2,'0')}.${single[3]} - ${single[1].padStart(2,'0')}.${single[2].padStart(2,'0')}.${single[3]}`)
      } else {
        // 3) "Toukokuu 2025" tai "toukokuu / 2025"
        const named = lower.match(new RegExp(`(${FI_MONTHS.join('|')})\\s*\\/?\\s*(\\d{4})`))
        if (named) {
          const m = FI_MONTHS.indexOf(named[1]) + 1
          const y = named[2]
          extra.push(`Tositepvm;01.${String(m).padStart(2,'0')}.${y} - 28.${String(m).padStart(2,'0')}.${y}`)
        } else {
          // 4) "05/2025" tai "2025-05"
          const num = text.match(/\b(0[1-9]|1[0-2])[\/-](\d{4})\b|\b(\d{4})[-\/](0[1-9]|1[0-2])\b/)
          if (num) {
            const m = num[1] || num[4]
            const y = num[2] || num[3]
            extra.push(`Tositepvm;01.${m}.${y} - 28.${m}.${y}`)
          }
        }
      }
    }
  }

  return extra.length ? extra.join('\n') + '\n' + text : text
}

// Tunnistaa tiedostotyypin nimen/mime:n perusteella
function detectKind(file) {
  const name = (file.name || '').toLowerCase()
  const type = (file.type || '').toLowerCase()
  if (name.endsWith('.xlsx') || type.includes('spreadsheetml')) return 'xlsx'
  if (name.endsWith('.pdf') || type === 'application/pdf') return 'pdf'
  return 'csv'
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

    const kind = detectKind(file)

    const tryParseCsv = (encoding) => new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsText(file, encoding)
    })

    let text
    try {
      if (kind === 'xlsx') {
        text = await readXlsxAsText(file)
      } else if (kind === 'pdf') {
        text = await readPdfAsText(file)
      } else {
        // Kokeile ensin latin-1 (Netvisor-oletusenkoodaus), sitten UTF-8
        try { text = await tryParseCsv('windows-1252') }
        catch { text = await tryParseCsv('UTF-8') }
      }
    } catch (e) {
      setResult({ ok: false, message: `Tiedoston luku epäonnistui: ${e.message || e}` })
      setStatus('error')
      return
    }

    text = enrichParsedText(text, file.name)
    let { reportType, period, dataRows } = parseNetvisorCSV(text)

    if (!reportType && kind === 'csv') {
      // Ei tunnistettu Netvisor-formaatiksi – yritä UTF-8
      const text2 = enrichParsedText(await tryParseCsv('UTF-8'), file.name)
      const parsed2 = parseNetvisorCSV(text2)
      if (parsed2.reportType) ({ reportType, period, dataRows } = parsed2)
    }

    const preview = text.split('\n').slice(0, 20).join('\n')

    if (!reportType) {
      setResult({
        ok: false,
        message: 'Tiedostoa ei tunnistettu Netvisor-tulos- tai -kassavirtaraportiksi. Varmista, että tiedosto sisältää tuloslaskelman tai kassavirran.',
        preview,
      })
      setStatus('error')
      return
    }

    if (!period) {
      setResult({
        ok: false,
        message: `Jakson päivämäärää ei löydetty. Varmista, että tiedosto sisältää raportin ajanjakson (esim. "01.05.2025 - 31.05.2025" tai "Toukokuu 2025").`,
        preview,
      })
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
          <h1 className="page-title">Tuo tiedosto</h1>
          <p className="page-subtitle">Tuo Netvisor-tuloslaskelma — CSV, XLSX tai PDF</p>
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
              {status === 'importing' ? `Tuodaan ${fileName}…` : 'Pudota Netvisor-tiedosto tähän'}
            </div>
            <div style={{ fontSize: '.82rem', color: 'var(--text3)' }}>
              {status === 'importing' ? 'Odota hetki…' : 'tai klikkaa valitaksesi tiedosto · Tuloslaskelma CSV, XLSX tai PDF'}
            </div>
            <input ref={fileRef} type="file"
              accept=".csv,text/csv,.txt,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.pdf,application/pdf"
              style={{ display: 'none' }} onChange={onFileChange} />
          </div>

          <div style={{ marginTop: '1.25rem', background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '.85rem 1rem', fontSize: '.8rem', color: 'var(--text3)' }}>
            <strong style={{ color: 'var(--text2)' }}>Tuetut formaatit:</strong> Netvisor-tuloslaskelma CSV:nä (<code>;</code>, Windows-1252 / UTF-8), XLSX-työkirjana tai PDF-raporttina.<br />
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
          {result.preview && (
            <div style={{ textAlign: 'left', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', marginBottom: '.35rem' }}>
                Mitä parseri näki (20 ensimmäistä riviä)
              </div>
              <pre style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.75rem 1rem', fontSize: '.72rem', color: 'var(--text2)', overflow: 'auto', maxHeight: 260, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {result.preview}
              </pre>
            </div>
          )}
          <button className="btn btn-ghost" onClick={reset}>Yritä uudelleen</button>
        </div>
      )}
    </div>
  )
}
