import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { supabaseAdmin } from '../../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

// ─── Sub-navigation (shared with other reporting pages) ──────────────────────

const REPORT_NAV = [
  { label: 'Terapiamyynti',   to: '/finance/raportointi/terapiamyynti' },
  { label: 'Valmennusmyynti', to: '/finance/raportointi/valmennusmyynti' },
  { label: 'Jäsenmyynti',     to: '/finance/raportointi/jasenmyynti' },
  { label: 'Lahjakortit',     to: '/finance/raportointi/lahjakortit' },
  { label: 'MobilePay',       to: '/finance/raportointi/mobilepay' },
]

function ReportNav() {
  return (
    <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
      <NavLink to="/finance/raportointi" end style={{ textDecoration: 'none' }}>
        <button className="sub-tab">← Yhteenveto</button>
      </NavLink>
      {REPORT_NAV.map(r => (
        <NavLink key={r.to} to={r.to} style={{ textDecoration: 'none' }}>
          {({ isActive }) => <button className={`sub-tab${isActive ? ' active' : ''}`}>{r.label}</button>}
        </NavLink>
      ))}
    </div>
  )
}

// ─── Period helpers ──────────────────────────────────────────────────────────

const PERIODS = [
  { label: 'Tällä viikolla', value: 'week' },
  { label: 'Tässä kuussa',   value: 'month' },
  { label: 'Tänä vuonna',    value: 'year' },
  { label: 'Kaikki',         value: 'all' },
  { label: 'Mukautettu',     value: 'custom' },
]

function getRange(period, customFrom, customTo) {
  const now = new Date()
  if (period === 'week') {
    const dow = now.getDay() || 7
    const mon = new Date(now); mon.setDate(now.getDate() - dow + 1)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) }
  }
  if (period === 'month') {
    return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to: now.toISOString().slice(0,10) }
  }
  if (period === 'year') return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().slice(0,10) }
  if (period === 'all')  return { from: '2000-01-01', to: '2100-12-31' }
  return { from: customFrom, to: customTo }
}

function fmtEur(v) {
  return Number(v||0).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// ─── CSV parsing ─────────────────────────────────────────────────────────────

// MobilePay CSV headers (Finnish). Order is fixed but we key by name.
const CSV_HEADERS = [
  'Myyntipaikka','MSN/MobilePay-lyhytnumero','Maa','Maksuratkaisu','Aika','Kirjauspäivä',
  'Tyyppi','Summa','Saldo','Palkkio','Nettosumma','Valuutta','Kategoria','PSP-viite',
  'Tilaustunnus/Viite','Maksunumero','Maksutili','Suunniteltu maksupäivä',
]

// Minimal RFC-4180 split for a single CSV line (handles quoted fields).
function splitCsvLine(line) {
  const out = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuote = false
      else cur += ch
    } else {
      if (ch === '"') inQuote = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out
}

function toNumber(v) {
  if (v == null || v === '') return null
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

function parseMobilePayCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return { ok: false, error: 'CSV on tyhjä.' }

  const header = splitCsvLine(lines[0]).map(h => h.trim())
  const missing = CSV_HEADERS.filter(h => !header.includes(h))
  if (missing.length > 0) {
    return { ok: false, error: `Sarakkeita puuttuu: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}. Onko tämä MobilePay-tilitysraportti?` }
  }
  const idx = Object.fromEntries(header.map((h, i) => [h, i]))

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const psp = (cols[idx['PSP-viite']] || '').trim()
    if (!psp) continue  // rows without PSP-viite are not upsertable

    const time = (cols[idx['Aika']] || '').trim()
    // 'YYYY-MM-DD HH:MM:SS' → ISO. Assume Europe/Helsinki export, treat as local.
    const transaction_time = time ? new Date(time.replace(' ', 'T')).toISOString() : null

    rows.push({
      psp_reference: psp,
      transaction_time,
      booking_date: (cols[idx['Kirjauspäivä']] || '').trim() || null,
      type: (cols[idx['Tyyppi']] || '').trim() || null,
      payment_solution: (cols[idx['Maksuratkaisu']] || '').trim() || null,
      amount: toNumber(cols[idx['Summa']]),
      balance: toNumber(cols[idx['Saldo']]),
      fee: toNumber(cols[idx['Palkkio']]),
      net_amount: toNumber(cols[idx['Nettosumma']]),
      currency: (cols[idx['Valuutta']] || '').trim() || 'EUR',
      category: (cols[idx['Kategoria']] || '').trim() || null,
      order_reference: (cols[idx['Tilaustunnus/Viite']] || '').trim() || null,
      payment_number: (cols[idx['Maksunumero']] || '').trim() || null,
      payout_account: (cols[idx['Maksutili']] || '').trim() || null,
      scheduled_payout_date: (cols[idx['Suunniteltu maksupäivä']] || '').trim() || null,
      merchant_location: (cols[idx['Myyntipaikka']] || '').trim() || null,
      msn: (cols[idx['MSN/MobilePay-lyhytnumero']] || '').trim() || null,
      country: (cols[idx['Maa']] || '').trim() || null,
    })
  }

  return { ok: true, rows }
}

// ─── Upload widget ───────────────────────────────────────────────────────────

function UploadCard({ onImported }) {
  const [status, setStatus] = useState('idle')  // idle | importing | done | error
  const [result, setResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileRef = useRef()

  async function handleFile(file) {
    if (!file) return
    setFileName(file.name)
    setStatus('importing')
    setResult(null)

    const readAs = (encoding) => new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsText(file, encoding)
    })

    let text
    try { text = await readAs('UTF-8') }
    catch { text = await readAs('windows-1252') }

    const parsed = parseMobilePayCsv(text)
    if (!parsed.ok) {
      setResult({ ok: false, message: parsed.error })
      setStatus('error')
      return
    }
    if (parsed.rows.length === 0) {
      setResult({ ok: false, message: 'CSV tunnistettiin, mutta rivejä ei löytynyt.' })
      setStatus('error')
      return
    }

    // Upsert in chunks of 500 to keep requests small.
    const CHUNK = 500
    let inserted = 0
    for (let i = 0; i < parsed.rows.length; i += CHUNK) {
      const chunk = parsed.rows.slice(i, i + CHUNK)
      const { error } = await supabaseAdmin
        .from('mobilepay_transactions')
        .upsert(chunk, { onConflict: 'psp_reference' })
      if (error) {
        setResult({ ok: false, message: `Tallennus epäonnistui: ${error.message}` })
        setStatus('error')
        return
      }
      inserted += chunk.length
    }

    setResult({ ok: true, message: `Tuotu ${inserted} tapahtumaa.` })
    setStatus('done')
    onImported?.()
  }

  function reset() {
    setStatus('idle'); setResult(null); setFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
      {(status === 'idle' || status === 'importing') && (
        <>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
            onClick={() => status !== 'importing' && fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--violet)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              padding: '1.5rem 1rem',
              textAlign: 'center',
              cursor: status === 'importing' ? 'wait' : 'pointer',
              background: dragOver ? 'var(--violet-subtle, #f5f3ff)' : 'var(--bg2)',
              transition: 'border-color .2s, background .2s',
            }}
          >
            <Upload size={24} style={{ color: 'var(--violet)', marginBottom: '.5rem' }} />
            <div style={{ fontWeight: 700, fontSize: '.95rem', marginBottom: '.25rem' }}>
              {status === 'importing' ? `Tuodaan ${fileName}…` : 'Pudota MobilePay-tilitysraportti (CSV)'}
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--text3)' }}>
              {status === 'importing' ? 'Odota hetki…' : 'tai klikkaa valitaksesi tiedosto'}
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          </div>
        </>
      )}

      {status === 'done' && result?.ok && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.5rem' }}>
          <CheckCircle size={22} style={{ color: 'var(--green)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--green)' }}>Tuonti onnistui</div>
            <div style={{ color: 'var(--text3)', fontSize: '.82rem' }}>{result.message}</div>
          </div>
          <button className="btn btn-ghost" onClick={reset}>Tuo uusi</button>
        </div>
      )}

      {status === 'error' && result && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.5rem' }}>
          <AlertCircle size={22} style={{ color: 'var(--red)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--red)' }}>Tuonti epäonnistui</div>
            <div style={{ color: 'var(--text3)', fontSize: '.82rem' }}>{result.message}</div>
          </div>
          <button className="btn btn-ghost" onClick={reset}>Yritä uudelleen</button>
        </div>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function RaportointiMobilePay() {
  const [period, setPeriod]         = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')
  const [rows, setRows]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [reloadKey, setReloadKey]   = useState(0)

  useEffect(() => { fetchData() }, [period, customFrom, customTo, reloadKey])

  async function fetchData() {
    const { from, to } = getRange(period, customFrom, customTo)
    if (!from || !to) return
    setLoading(true)
    const { data, error } = await supabaseAdmin
      .from('mobilepay_transactions')
      .select('*')
      .gte('booking_date', from)
      .lte('booking_date', to)
      .order('transaction_time', { ascending: false })
      .limit(10000)
    if (error) console.error(error)
    setRows(data || [])
    setLoading(false)
  }

  // Split rows by type
  const sales   = rows.filter(r => r.type === 'Toteutunut')
  const fees    = rows.filter(r => r.type === 'Palkkiot vähennetty')
  const payouts = rows.filter(r => r.type === 'Maksu suunniteltu')

  const gross = sales.reduce((s, r) => s + (r.amount || 0), 0)
  const feesTotal = fees.reduce((s, r) => s + Math.abs(r.amount || 0), 0) +
                    sales.reduce((s, r) => s + Math.abs(r.fee || 0), 0)
  // Prefer sum of net_amount on 'Toteutunut' rows; falls back to gross - fees.
  const net = sales.reduce((s, r) => s + (r.net_amount || 0), 0)
  const avg = sales.length ? gross / sales.length : 0
  const payoutTotal = payouts.reduce((s, r) => s + Math.abs(r.amount || 0), 0)

  // Chart: daily gross vs net
  const daily = {}
  sales.forEach(r => {
    const d = r.booking_date
    if (!d) return
    if (!daily[d]) daily[d] = { date: d, brutto: 0, netto: 0, palkkio: 0, count: 0 }
    daily[d].brutto  += r.amount || 0
    daily[d].netto   += r.net_amount || 0
    daily[d].palkkio += Math.abs(r.fee || 0)
    daily[d].count   += 1
  })
  const chartData = Object.values(daily)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      label: d.date.slice(5),        // 'MM-DD'
      Brutto: +d.brutto.toFixed(2),
      Netto:  +d.netto.toFixed(2),
    }))

  const periodLabel = PERIODS.find(p => p.value === period)?.label || ''

  return (
    <div>
      <ReportNav />

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">MobilePay — Raportti</h1>
          <p className="page-subtitle">Lataa viikoittain MobilePayn tilitysraportti (CSV)</p>
        </div>
      </div>

      <UploadCard onImported={() => setReloadKey(k => k + 1)} />

      {/* Period selector */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {PERIODS.map(p => (
          <button key={p.value} className={`sub-tab${period === p.value ? ' active' : ''}`} onClick={() => setPeriod(p.value)}>
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginLeft: '.5rem' }}>
            <input className="input-field" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ width: 150 }} />
            <span style={{ color: 'var(--text3)' }}>–</span>
            <input className="input-field" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ width: 150 }} />
          </div>
        )}
      </div>

      {/* Summary stat cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Bruttomyynti</div>
          <div className="stat-value gold">{loading ? '…' : fmtEur(gross)}</div>
          <div style={{ fontSize: '.72rem', color: 'var(--text3)' }}>{periodLabel}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Palkkiot</div>
          <div className="stat-value" style={{ color: 'var(--red, #DC2626)' }}>{loading ? '…' : fmtEur(feesTotal)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Nettomyynti</div>
          <div className="stat-value" style={{ color: 'var(--green, #16A34A)' }}>{loading ? '…' : fmtEur(net)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tapahtumia</div>
          <div className="stat-value">{loading ? '…' : sales.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Keskiarvo</div>
          <div className="stat-value">{loading ? '…' : fmtEur(avg)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tilitetty pankkiin</div>
          <div className="stat-value">{loading ? '…' : fmtEur(payoutTotal)}</div>
          <div style={{ fontSize: '.72rem', color: 'var(--text3)' }}>{payouts.length} tilitystä</div>
        </div>
      </div>

      {/* Chart */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>
            Myynnin kehitys
          </h2>
          <span style={{ fontSize: '.72rem', color: 'var(--text3)' }}>päivittäin, brutto ja netto</span>
        </div>
        {loading ? (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '.83rem' }}>Ladataan…</div>
        ) : chartData.length === 0 ? (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '.83rem' }}>Ei tapahtumia valitulla aikavälillä.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text3)' }} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} width={38} />
              <Tooltip
                formatter={(v) => fmtEur(v)}
                contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '.78rem' }}
              />
              <Legend wrapperStyle={{ fontSize: '.78rem', paddingTop: '.5rem' }} />
              <Bar dataKey="Brutto" fill="#7C3AED" maxBarSize={30} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Netto"  fill="#16A34A" maxBarSize={30} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Payouts & transactions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.75rem' }}>
            Toteutuneet maksut ({sales.length})
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Aika</th>
                  <th>Summa</th>
                  <th>Palkkio</th>
                  <th>Netto</th>
                  <th>Viite</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="table-empty">Ladataan…</td></tr>
                ) : sales.length === 0 ? (
                  <tr><td colSpan={5} className="table-empty">Ei tapahtumia valitulla aikavälillä.</td></tr>
                ) : sales.slice(0, 500).map(r => (
                  <tr key={r.id}>
                    <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>
                      {r.transaction_time ? new Date(r.transaction_time).toLocaleString('fi-FI', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--violet)' }}>{fmtEur(r.amount)}</td>
                    <td style={{ color: 'var(--red, #DC2626)', fontSize: '.83rem' }}>{r.fee != null ? fmtEur(Math.abs(r.fee)) : '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--green, #16A34A)' }}>{fmtEur(r.net_amount)}</td>
                    <td style={{ color: 'var(--text3)', fontSize: '.72rem', fontFamily: 'monospace' }}>{r.psp_reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sales.length > 500 && (
              <div style={{ padding: '.5rem 1rem', color: 'var(--text3)', fontSize: '.75rem' }}>
                Näytetään ensimmäiset 500 riviä {sales.length} tapahtumasta.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>
            Tilitykset pankkitilille
          </h3>
          {payouts.length === 0 && (
            <p style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ei tilityksiä valitulla aikavälillä.</p>
          )}
          {payouts
            .slice()
            .sort((a, b) => (b.scheduled_payout_date || '').localeCompare(a.scheduled_payout_date || ''))
            .slice(0, 30)
            .map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '.83rem' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {p.scheduled_payout_date ? new Date(p.scheduled_payout_date).toLocaleDateString('fi-FI') : (p.booking_date ? new Date(p.booking_date).toLocaleDateString('fi-FI') : '—')}
                  </div>
                  <div style={{ color: 'var(--text3)', fontSize: '.72rem' }}>{p.payment_number || '—'}</div>
                </div>
                <strong>{fmtEur(Math.abs(p.amount || 0))}</strong>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
