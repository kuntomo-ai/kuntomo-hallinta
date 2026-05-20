import { useState, useRef } from 'react'
import { Upload, Download, CheckCircle, AlertCircle, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import KirjanpitoNav from '../../components/KirjanpitoNav'

// ── Raporttityypit ja niiden kenttämäärittelyt ─────────────────────────────
const REPORT_TYPES = [
  {
    key: 'tulos',
    label: 'Tuloslaskelma',
    table: 'tulos_account_entries',
    fields: [
      { key: 'account_name', label: 'Tilin nimi', required: true, aliases: ['tilin nimi','tili','account name','account','nimi','name','kuvaus'] },
      { key: 'account_group', label: 'Ryhmä (tuotot/kulut)', required: true, aliases: ['ryhmä','group','tyyppi','type','luokka'], transform: normalizeGroup },
      { key: 'amount', label: 'Summa (€)', required: true, aliases: ['summa','amount','määrä','saldo','balance'], transform: parseAmount },
      { key: 'period', label: 'Tilikausi', required: false, aliases: ['tilikausi','period','kausi','vuosi','year'] },
    ],
    template: 'tilin_nimi;ryhmä;summa;tilikausi\nMyyntituotot;tuotot;50000.00;2024\nPalkat ja palkkiot;kulut;30000.00;2024\n',
    templateName: 'tuloslaskelma_pohja.csv',
  },
  {
    key: 'tase',
    label: 'Tase',
    table: 'tase_account_entries',
    fields: [
      { key: 'account_name', label: 'Tilin nimi', required: true, aliases: ['tilin nimi','tili','account name','account','nimi','name'] },
      { key: 'account_group', label: 'Ryhmä (vastaavaa/vastattavaa)', required: true, aliases: ['ryhmä','group','tyyppi','type','puoli','side'], transform: normalizeBalanceGroup },
      { key: 'amount', label: 'Summa (€)', required: true, aliases: ['summa','amount','määrä','saldo','balance'], transform: parseAmount },
      { key: 'period', label: 'Tilikausi', required: false, aliases: ['tilikausi','period','kausi','vuosi','year'] },
      { key: 'notes', label: 'Muistiinpanot', required: false, aliases: ['muistiinpanot','notes','huomio','comment','lisätieto'] },
    ],
    template: 'tilin_nimi;ryhmä;summa;tilikausi;muistiinpanot\nKassa;vastaavaa;15000.00;2024;\nOsakepääoma;vastattavaa;15000.00;2024;\n',
    templateName: 'tase_pohja.csv',
  },
  {
    key: 'kassavirta',
    label: 'Kassavirta',
    table: 'kassavirta_entries',
    fields: [
      { key: 'description', label: 'Kuvaus', required: true, aliases: ['kuvaus','description','selite','selitys','nimi','name'] },
      { key: 'entry_type', label: 'Tyyppi (tulo/meno)', required: true, aliases: ['tyyppi','type','laji','suunta','kirjaustyyppi'], transform: normalizeEntryType },
      { key: 'amount', label: 'Summa (€)', required: true, aliases: ['summa','amount','määrä','saldo','balance'], transform: parseAmount },
      { key: 'entry_date', label: 'Päivämäärä', required: false, aliases: ['päivämäärä','date','pvm','päiväys','tapahtumapäivä'], transform: parseDate },
      { key: 'notes', label: 'Muistiinpanot', required: false, aliases: ['muistiinpanot','notes','huomio','comment','lisätieto'] },
    ],
    template: 'kuvaus;tyyppi;summa;päivämäärä;muistiinpanot\nMyyntilasku 001;tulo;1500.00;2024-01-15;Asiakas Oy\nToimistovuokra;meno;800.00;2024-01-20;Tammikuu\n',
    templateName: 'kassavirta_pohja.csv',
  },
]

// ── Muunnosfunktiot ────────────────────────────────────────────────────────
function parseAmount(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : Math.abs(n)
}

function parseDate(v) {
  if (!v) return null
  const s = String(v).trim()
  // dd.mm.yyyy → yyyy-mm-dd
  const fi = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (fi) return `${fi[3]}-${fi[2].padStart(2,'0')}-${fi[1].padStart(2,'0')}`
  // yyyy-mm-dd already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return s || null
}

function normalizeGroup(v) {
  const s = String(v || '').toLowerCase().trim()
  if (['tuotot','tulo','tulot','revenue','income'].some(x => s.includes(x))) return 'tuotot'
  if (['kulut','kulu','kustannus','expense','cost','meno'].some(x => s.includes(x))) return 'kulut'
  return s
}

function normalizeBalanceGroup(v) {
  const s = String(v || '').toLowerCase().trim()
  if (['vastaavaa','aktiva','asset','omaisuus'].some(x => s.includes(x))) return 'vastaavaa'
  if (['vastattavaa','passiva','liabilit','velat','pääoma'].some(x => s.includes(x))) return 'vastattavaa'
  return s
}

function normalizeEntryType(v) {
  const s = String(v || '').toLowerCase().trim()
  if (['tulo','tulot','income','revenue','kredit','suoritus'].some(x => s.includes(x))) return 'tulo'
  if (['meno','menot','expense','cost','debet','lasku','maksu'].some(x => s.includes(x))) return 'meno'
  return s
}

// ── CSV-parsija ───────────────────────────────────────────────────────────
function detectSeparator(text) {
  const firstLine = text.split('\n')[0] || ''
  const semis = (firstLine.match(/;/g) || []).length
  const commas = (firstLine.match(/,/g) || []).length
  return semis >= commas ? ';' : ','
}

function parseCSV(text) {
  const sep = detectSeparator(text)
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  const rows = lines.slice(1).map(line => {
    const cells = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cells[i] ?? '' })
    return obj
  })
  return { headers, rows, sep }
}

// Automaattinen sarakekartoitus
function autoMap(headers, fields) {
  const mapping = {}
  for (const field of fields) {
    const match = headers.find(h => field.aliases.some(alias => h.includes(alias)))
    mapping[field.key] = match || ''
  }
  return mapping
}

// ── Pääkomponentti ─────────────────────────────────────────────────────────
export default function KirjanpitoTuonti() {
  const [reportType, setReportType] = useState(REPORT_TYPES[0].key)
  const [step, setStep] = useState('upload') // upload | map | preview | done
  const [parsed, setParsed] = useState(null)   // { headers, rows, sep }
  const [mapping, setMapping] = useState({})   // fieldKey → csvHeader
  const [preview, setPreview] = useState([])   // mapped rows
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)   // { ok, errors }
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const rtype = REPORT_TYPES.find(r => r.key === reportType)

  // ── Tiedoston käsittely ──────────────────────────────────────────────────
  function handleFile(file) {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target.result
      const p = parseCSV(text)
      if (!p.headers.length) { alert('CSV-tiedosto on tyhjä tai virheellinen.'); return }
      const auto = autoMap(p.headers, rtype.fields)
      setParsed(p)
      setMapping(auto)
      setStep('map')
      setResult(null)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function onFileChange(e) { handleFile(e.target.files[0]) }
  function onDrop(e) {
    e.preventDefault(); setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  // ── Esikatselu ───────────────────────────────────────────────────────────
  function buildPreview() {
    const rows = parsed.rows.map(raw => {
      const row = {}
      for (const field of rtype.fields) {
        const col = mapping[field.key]
        let val = col ? (raw[col] ?? '') : ''
        if (field.transform) val = field.transform(val)
        row[field.key] = val
      }
      return row
    }).filter(row => {
      // Suodata tyhjät rivit
      return rtype.fields.filter(f => f.required).every(f => row[f.key] !== null && row[f.key] !== '' && row[f.key] !== undefined)
    })
    setPreview(rows)
    setStep('preview')
  }

  // ── Tuonti Supabaseen ────────────────────────────────────────────────────
  async function handleImport() {
    setImporting(true)
    const table = rtype.table
    let ok = 0, errors = []
    const BATCH = 50
    for (let i = 0; i < preview.length; i += BATCH) {
      const batch = preview.slice(i, i + BATCH)
      const { error } = await supabase.from(table).insert(batch)
      if (error) {
        errors.push(`Rivit ${i+1}–${Math.min(i+BATCH, preview.length)}: ${error.message}`)
      } else {
        ok += batch.length
      }
    }
    setResult({ ok, errors })
    setStep('done')
    setImporting(false)
  }

  // ── Pohjan lataus ────────────────────────────────────────────────────────
  function downloadTemplate() {
    const blob = new Blob([rtype.template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = rtype.templateName; a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setStep('upload'); setParsed(null); setMapping({}); setPreview([])
    setFileName(''); setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <KirjanpitoNav />
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">CSV-tuonti</h1>
          <p className="page-subtitle">Tuo kirjanpitoraportteja CSV-tiedostosta</p>
        </div>
      </div>

      {/* Raporttityyppi */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
        <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: '.75rem', color: 'var(--text2)' }}>
          1. Valitse raporttityyppi
        </div>
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
          {REPORT_TYPES.map(r => (
            <button
              key={r.key}
              onClick={() => { setReportType(r.key); reset() }}
              className={reportType === r.key ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ minWidth: 140 }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vaihe: Upload */}
      {step === 'upload' && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: '.75rem', color: 'var(--text2)' }}>
            2. Lataa CSV-tiedosto
          </div>

          {/* Ohje */}
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '.85rem 1rem', marginBottom: '1.25rem', fontSize: '.82rem', color: 'var(--text3)' }}>
            <div style={{ marginBottom: '.4rem', fontWeight: 600, color: 'var(--text2)' }}>Odotetut sarakkeet ({rtype.label}):</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
              {rtype.fields.map(f => (
                <span key={f.key} style={{
                  background: f.required ? 'var(--violet-subtle)' : 'var(--bg2)',
                  color: f.required ? 'var(--violet)' : 'var(--text3)',
                  borderRadius: 4, padding: '2px 8px', fontSize: '.75rem', fontWeight: 600
                }}>
                  {f.label}{f.required ? ' *' : ''}
                </span>
              ))}
            </div>
            <div style={{ marginTop: '.5rem', fontSize: '.75rem' }}>
              Erottimena toimii <strong>;</strong> (puolipiste) tai <strong>,</strong> (pilkku). Desimaalierottimena käy sekä piste että pilkku.
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--violet)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              padding: '2.5rem 1rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'var(--violet-subtle)' : 'var(--bg2)',
              transition: 'border-color .2s, background .2s',
              marginBottom: '1rem',
            }}
          >
            <Upload size={28} style={{ color: 'var(--violet)', marginBottom: '.75rem' }} />
            <div style={{ fontWeight: 700, fontSize: '.95rem', marginBottom: '.35rem' }}>
              Pudota CSV-tiedosto tähän
            </div>
            <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>tai klikkaa valitaksesi tiedosto</div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onFileChange} />
          </div>

          {/* Pohja-lataus */}
          <button className="btn btn-ghost" onClick={downloadTemplate} style={{ width: '100%' }}>
            <Download size={14} /> Lataa pohja-CSV ({rtype.label.toLowerCase()})
          </button>
        </div>
      )}

      {/* Vaihe: Sarakekartoitus */}
      {step === 'map' && parsed && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: '.1rem', color: 'var(--text2)' }}>
            2. Yhdistä sarakkeet
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--text3)', marginBottom: '1rem' }}>
            Tiedosto: <strong>{fileName}</strong> · {parsed.rows.length} riviä · Erotin: <code>{parsed.sep}</code>
          </div>

          <div className="form-grid">
            {rtype.fields.map(field => (
              <div key={field.key} className="form-grid form-grid-2" style={{ gap: '.5rem', alignItems: 'center' }}>
                <div style={{ fontSize: '.82rem', fontWeight: 600, color: mapping[field.key] ? 'var(--text1)' : 'var(--text3)' }}>
                  {field.label}{field.required && <span style={{ color: 'var(--red)' }}> *</span>}
                </div>
                <select
                  className="input-field"
                  value={mapping[field.key] || ''}
                  onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
                >
                  <option value="">— jätä tyhjäksi —</option>
                  {parsed.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Esikatselu muutamasta rivistä */}
          {parsed.rows.length > 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text3)', marginBottom: '.5rem' }}>
                Esimerkkidata (3 ensimmäistä riviä):
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '.75rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {parsed.headers.map(h => (
                        <th key={h} style={{ padding: '.35rem .6rem', background: 'var(--bg3)', textAlign: 'left', whiteSpace: 'nowrap', border: '1px solid var(--border)', color: 'var(--text3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        {parsed.headers.map(h => (
                          <td key={h} style={{ padding: '.3rem .6rem', border: '1px solid var(--border)', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.25rem' }}>
            <button className="btn btn-ghost" onClick={reset}>Peruuta</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={buildPreview}>
              Esikatsele →
            </button>
          </div>
        </div>
      )}

      {/* Vaihe: Esikatselu */}
      {step === 'preview' && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: '.4rem', color: 'var(--text2)' }}>
              3. Tarkista esikatselu
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--text3)' }}>
              {preview.length} riviä tuodaan taulukkoon <strong>{rtype.table}</strong>.{' '}
              {parsed.rows.length - preview.length > 0 &&
                <span style={{ color: 'var(--orange)' }}>
                  {parsed.rows.length - preview.length} riviä jätettiin pois (puuttuvat pakolliset kentät).
                </span>
              }
            </div>
          </div>

          {preview.length === 0 ? (
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text3)' }}>
              <AlertCircle size={28} style={{ marginBottom: '.75rem', color: 'var(--orange)' }} />
              <div>Ei tuotavia rivejä. Tarkista sarakekartoitus.</div>
              <button className="btn btn-ghost" style={{ marginTop: '1rem' }} onClick={() => setStep('map')}>← Takaisin</button>
            </div>
          ) : (
            <>
              <div className="table-wrap" style={{ marginBottom: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      {rtype.fields.map(f => <th key={f.key}>{f.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 100).map((row, i) => (
                      <tr key={i}>
                        {rtype.fields.map(f => (
                          <td key={f.key} style={{
                            fontSize: '.8rem',
                            color: (row[f.key] === null || row[f.key] === '') ? 'var(--text3)' : 'var(--text1)',
                            fontWeight: f.key === 'amount' || f.key === 'account_name' || f.key === 'description' ? 600 : 400,
                          }}>
                            {row[f.key] != null && row[f.key] !== ''
                              ? (f.key === 'amount' ? `${Number(row[f.key]).toFixed(2)} €` : String(row[f.key]))
                              : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {preview.length > 100 && (
                      <tr><td colSpan={rtype.fields.length} style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '.78rem' }}>
                        … ja {preview.length - 100} riviä lisää
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: '.75rem' }}>
                <button className="btn btn-ghost" onClick={() => setStep('map')}>← Takaisin</button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? `Tuodaan ${preview.length} riviä...` : `Tuo ${preview.length} riviä →`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Vaihe: Valmis */}
      {step === 'done' && result && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.25rem' }}>
          {result.ok > 0 ? (
            <CheckCircle size={40} style={{ color: 'var(--green)', marginBottom: '1rem' }} />
          ) : (
            <AlertCircle size={40} style={{ color: 'var(--red)', marginBottom: '1rem' }} />
          )}
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem', marginBottom: '.5rem' }}>
            {result.ok > 0 ? 'Tuonti onnistui!' : 'Tuonti epäonnistui'}
          </div>
          {result.ok > 0 && (
            <div style={{ color: 'var(--green)', fontWeight: 600, marginBottom: '.75rem' }}>
              {result.ok} riviä tuotu onnistuneesti
            </div>
          )}
          {result.errors.length > 0 && (
            <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '.75rem', marginBottom: '1rem', textAlign: 'left', fontSize: '.78rem', color: 'var(--red)' }}>
              {result.errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
            </div>
          )}
          <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', marginTop: '1rem' }}>
            <button className="btn btn-ghost" onClick={reset}>Tuo uusi tiedosto</button>
            <a
              href={`/finance/kirjanpito/${reportType === 'tulos' ? 'tulos' : reportType === 'tase' ? 'tase' : 'kassavirta'}`}
              className="btn btn-primary"
            >
              Katso {rtype.label} →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
