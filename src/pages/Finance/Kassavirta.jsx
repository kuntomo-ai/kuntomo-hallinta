import { useRef, useState, useEffect } from 'react'
import {
  ComposedChart, AreaChart, Area, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Download, Upload, FileText, FileSpreadsheet, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import KirjanpitoNav from '../../components/KirjanpitoNav'
import { supabaseAdmin } from '../../lib/supabase'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Oletusarvot ───────────────────────────────────────────────────────────────
const DEFAULTS = {
  alkukassa:        177000,
  liikevaihto:      160000,
  muut_tuotot:        9200,
  kasvu:               2.0,
  ulkopuoliset_pct:   46.2,
  ostot_pct:           2.4,
  vuokrat:           28000,
  palkat:             7330,
  atk:                5700,
  leasing:            2500,
  markkinointi:       2100,
  muut_kiinteat:      9500,
  lainanlyhennykset:  5400,
  rahoituskulut:      1270,
  horisontti:           12,
}

const MONTH_LABELS = {
  '2025-05': 'Touko 25', '2025-06': 'Kesä 25',   '2025-07': 'Heinä 25',
  '2025-08': 'Elo 25',   '2025-09': 'Syys 25',   '2025-10': 'Loka 25',
  '2025-11': 'Marras 25','2025-12': 'Joulu 25',  '2026-01': 'Tammi 26',
  '2026-02': 'Helmi 26', '2026-03': 'Maalis 26', '2026-04': 'Huhti 26',
  '2026-05': 'Touko 26', '2026-06': 'Kesä 26',   '2026-07': 'Heinä 26',
  '2026-08': 'Elo 26',   '2026-09': 'Syys 26',   '2026-10': 'Loka 26',
  '2026-11': 'Marras 26','2026-12': 'Joulu 26',
}

// ── Laskenta ──────────────────────────────────────────────────────────────────
function fmt(n, decimals = 0) {
  const abs = Math.abs(n)
  const str = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: decimals }).format(abs) + ' €'
  return n < 0 ? `−${str}` : str
}

function calcMonths(p) {
  const months = []
  let cumulative = p.alkukassa
  for (let i = 0; i < p.horisontti; i++) {
    const revenue         = (p.liikevaihto + p.muut_tuotot) * Math.pow(1 + p.kasvu / 100, i)
    const liikevaihto_only = p.liikevaihto * Math.pow(1 + p.kasvu / 100, i)
    const ulkopuoliset    = liikevaihto_only * (p.ulkopuoliset_pct / 100)
    const ostot           = liikevaihto_only * (p.ostot_pct / 100)
    const kiinteat        = p.vuokrat + p.palkat + p.atk + p.leasing + p.markkinointi + p.muut_kiinteat
    const rahoitus        = p.lainanlyhennykset + p.rahoituskulut
    const totalCosts      = ulkopuoliset + ostot + kiinteat + rahoitus
    const netCash         = revenue - totalCosts
    cumulative           += netCash
    months.push({
      kk:             i + 1,
      label:          `enn. +${i + 1}`,
      liikevaihto:    Math.round(revenue),
      ulkopuoliset:   Math.round(ulkopuoliset),
      ostot:          Math.round(ostot),
      kiinteat:       Math.round(kiinteat),
      rahoitus:       Math.round(rahoitus),
      totalCosts:     Math.round(totalCosts),
      kassavirta:     Math.round(netCash),
      kumulatiivinen: Math.round(cumulative),
    })
  }
  return months
}

function calcKPIs(months) {
  const breakEvenIdx = months.findIndex(m => m.kassavirta >= 0)
  const breakEven    = breakEvenIdx === -1 ? null : breakEvenIdx + 1
  const negIdx       = months.findIndex(m => m.kumulatiivinen < 0)
  const runway       = negIdx === -1 ? null : negIdx
  const loppukassa   = months[months.length - 1]?.kumulatiivinen ?? 0
  const avgNet       = months.length ? Math.round(months.reduce((s, m) => s + m.kassavirta, 0) / months.length) : 0
  const totalNet     = months.reduce((s, m) => s + m.kassavirta, 0)
  return { breakEven, runway, loppukassa, avgNet, totalNet }
}

// Kassavirta-approx toteutuneesta tuloslaskelmasta:
// tilikauden_voitto + poistot (lisätään takaisin ei-kassavaikutteinen erä) - lainanlyhennykset
function actualNetto(r, lainanlyhennykset) {
  return Math.round(
    (r.tilikauden_voitto || 0)
    + Math.abs(r.poistot || 0)
    - lainanlyhennykset
  )
}

// Johda ennusteparametrit viimeisen 3 kk toteutumista
function deriveParams(rows, alkukassa, current) {
  if (!rows.length) return null
  const recent = rows.slice(-3)
  const avg    = key => recent.reduce((s, r) => s + (r[key] || 0), 0) / recent.length
  const avgLv  = avg('liikevaihto')
  const avgMat = Math.abs(avg('materiaalit_palvelut'))
  return {
    ...current,
    alkukassa:         Math.round(alkukassa),
    liikevaihto:       Math.round(avgLv),
    muut_tuotot:       Math.round(avg('muut_tuotot')),
    ulkopuoliset_pct:  avgLv > 0 ? Math.round((avgMat / avgLv) * 1000) / 10 : current.ulkopuoliset_pct,
    palkat:            Math.round(Math.abs(avg('henkilostokulut'))),
    muut_kiinteat:     Math.round(Math.abs(avg('muut_kulut'))),
  }
}

// ── Komponentit ───────────────────────────────────────────────────────────────
function NI({ label, value, onChange, suffix = '€', step = 100, note }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
      <label style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text2)', letterSpacing: '.02em' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
        <input className="input-field" type="number" step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1, fontSize: '.85rem', padding: '.35rem .6rem', height: 'auto' }} />
        <span style={{ color: 'var(--text3)', fontSize: '.78rem', flexShrink: 0, minWidth: 16 }}>{suffix}</span>
      </div>
      {note && <span style={{ fontSize: '.7rem', color: 'var(--text3)' }}>{note}</span>}
    </div>
  )
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '.75rem' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: open ? '.65rem' : 0 }}>
        <span style={{ fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)' }}>{title}</span>
        {open ? <ChevronUp size={13} color="var(--text3)" /> : <ChevronDown size={13} color="var(--text3)" />}
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }}>{children}</div>}
    </div>
  )
}

const VIOLET = '#7C3AED'
const GREEN  = '#16A34A'
const RED    = '#DC2626'
const AMBER  = '#D97706'
const BLUE   = '#2563EB'
const ROSE   = '#E11D48'
const GREY   = '#94A3B8'

function EuroTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '.55rem .85rem', fontSize: '.76rem', minWidth: 180 }}>
      <div style={{ fontWeight: 700, marginBottom: '.3rem', color: 'var(--text)' }}>{label}</div>
      {payload.filter(p => p.value != null).map(p => (
        <div key={p.name} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>{p.name}</span>
          <strong>{fmt(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

// ── Pääkomponentti ────────────────────────────────────────────────────────────
export default function Kassavirta() {
  const [p,               setP]               = useState(DEFAULTS)
  const [actuals,         setActuals]         = useState([])
  const [actualsLoading,  setActualsLoading]  = useState(true)
  const [actualsUpdated,  setActualsUpdated]  = useState(null)
  const fileRef = useRef(null)

  const set = key => val => setP(prev => ({ ...prev, [key]: val }))

  // ── Lataa toteutumat Supabasesta ─────────────────────────────────────────
  async function loadActuals() {
    setActualsLoading(true)
    const [tulosRes, taseRes] = await Promise.all([
      supabaseAdmin
        .from('tulos_kuukausiraportti')
        .select('period, liikevaihto, muut_tuotot, materiaalit_palvelut, henkilostokulut, muut_kulut, poistot, tilikauden_voitto')
        .order('period', { ascending: true }),
      supabaseAdmin
        .from('tase_snapshot')
        .select('sub_section, loppusaldo'),
    ])

    const rows    = tulosRes.data || []
    const tase    = taseRes.data  || []
    const alkukassa = tase
      .filter(r => r.sub_section === 'rahat')
      .reduce((s, r) => s + (r.loppusaldo || 0), 0)

    setActuals(rows)

    // Auto-täytä parametrit toteutumista
    const derived = deriveParams(rows, alkukassa || DEFAULTS.alkukassa, p)
    if (derived) setP(derived)

    setActualsUpdated(new Date())
    setActualsLoading(false)
  }

  useEffect(() => { loadActuals() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Laskettu data ────────────────────────────────────────────────────────
  const months = calcMonths(p)
  const kpis   = calcKPIs(months)

  // Toteutuneiden kuukausien kassavirta-approx
  const actualChartData = actuals.map(r => ({
    label:               MONTH_LABELS[r.period] || r.period,
    kassavirta_toteutunut: actualNetto(r, p.lainanlyhennykset),
    kassavirta_ennuste:  null,
    liikevaihto:         Math.round(r.liikevaihto || 0),
    isActual:            true,
    period:              r.period,
  }))

  const forecastChartData = months.map(m => ({
    label:                 m.label,
    kassavirta_toteutunut: null,
    kassavirta_ennuste:    m.kassavirta,
    kumulatiivinen:        m.kumulatiivinen,
    liikevaihto:           m.liikevaihto,
    isActual:              false,
  }))

  const combinedData = [...actualChartData, ...forecastChartData]

  // Kulujakauma kk 1
  const cashOk = kpis.loppukassa >= 0
  const m0     = months[0] ?? {}
  const breakdown = [
    { name: 'Ulkopuoliset palv.', value: m0.ulkopuoliset,                          color: ROSE },
    { name: 'Vuokrat',             value: p.vuokrat,                                color: AMBER },
    { name: 'Palkat',              value: p.palkat,                                 color: BLUE },
    { name: 'ATK + leasing',       value: p.atk + p.leasing,                        color: '#8B5CF6' },
    { name: 'Ostot',               value: m0.ostot,                                 color: '#0891B2' },
    { name: 'Markkinointi + muut', value: p.markkinointi + p.muut_kiinteat,         color: '#059669' },
    { name: 'Lainanlyhennykset',   value: p.lainanlyhennykset + p.rahoituskulut,    color: '#64748B' },
  ]
  const totalCosts0 = breakdown.reduce((s, b) => s + (b.value || 0), 0)

  // ── Viennit ──────────────────────────────────────────────────────────────
  function exportExcel() {
    const rows = [
      ['Kk', 'Liikevaihto', 'Ulkopuoliset palv.', 'Ostot', 'Kiinteät kulut', 'Rahoitus', 'Kassavirta', 'Kumulatiivinen'],
      ...months.map(m => [m.label, m.liikevaihto, m.ulkopuoliset, m.ostot, m.kiinteat, m.rahoitus, m.kassavirta, m.kumulatiivinen]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kassavirta')
    XLSX.writeFile(wb, 'kassavirta_ennuste.xlsx')
  }

  function exportPDF() {
    const doc = new jsPDF()
    doc.setFontSize(15); doc.text('Kassavirta-ennuste — Kuntomo Oy', 14, 16)
    doc.setFontSize(8)
    autoTable(doc, {
      startY: 30,
      head: [['Kk', 'Liikevaihto', 'Ulkopuol.', 'Kiinteät', 'Kulut yht.', 'Kassavirta', 'Kumulat.']],
      body: months.map(m => [m.label, fmt(m.liikevaihto), fmt(m.ulkopuoliset), fmt(m.kiinteat), fmt(m.totalCosts), fmt(m.kassavirta), fmt(m.kumulatiivinen)]),
      styles: { fontSize: 7 }, headStyles: { fillColor: [124, 58, 237] },
      alternateRowStyles: { fillColor: [245, 243, 255] },
    })
    doc.save('kassavirta_ennuste.pdf')
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ params: p, months }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'kassavirta_ennuste.json'; a.click()
    URL.revokeObjectURL(url)
  }

  function loadJSON(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try { const { params } = JSON.parse(ev.target.result); if (params) setP({ ...DEFAULTS, ...params }) }
      catch { alert('Virheellinen JSON-tiedosto.') }
    }
    reader.readAsText(file); e.target.value = ''
  }

  return (
    <div>
      <KirjanpitoNav />
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Kassavirta</h1>
          <p className="page-subtitle">
            Ennuste · parametrit johdettu automaattisesti viimeisimmistä toteutumista
            {actualsUpdated && !actualsLoading && (
              <span style={{ marginLeft: '.6rem', fontSize: '.72rem', color: 'var(--text3)' }}>
                · Toteutumia: <b>{actuals.length} kk</b>
                {' · Päivitetty: '}{actualsUpdated.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={loadActuals} disabled={actualsLoading}
            style={{ gap: '.3rem' }}>
            <RefreshCw size={13} style={{ animation: actualsLoading ? 'spin 1s linear infinite' : 'none' }} />
            {actualsLoading ? 'Ladataan…' : 'Päivitä toteutuma'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={exportExcel}><FileSpreadsheet size={14} /> Excel</button>
          <button className="btn btn-ghost btn-sm" onClick={exportPDF}><FileText size={14} /> PDF</button>
          <button className="btn btn-ghost btn-sm" onClick={exportJSON}><Download size={14} /> JSON</button>
          <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}><Upload size={14} /> Lataa</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={loadJSON} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) 1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* ── Parametrilomake ── */}
        <div className="card" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.92rem', margin: 0 }}>Parametrit</h3>
            {actuals.length > 0 && (
              <span style={{ fontSize: '.68rem', background: 'var(--violet-subtle, rgba(124,92,191,.1))', color: 'var(--violet, #7c3aed)',
                borderRadius: 4, padding: '.1rem .45rem', fontWeight: 600 }}>
                ↑ johdettu {actuals.length} kk toteutumista
              </span>
            )}
          </div>

          <Section title="Tulot">
            <NI label="Liikevaihto / kk" value={p.liikevaihto} onChange={set('liikevaihto')} step={1000} note="Myynnistä saatava liikevaihto" />
            <NI label="Muut tuotot / kk" value={p.muut_tuotot} onChange={set('muut_tuotot')} step={500} note="Vuokratuotot ym." />
            <NI label="Kuukausikasvu" value={p.kasvu} onChange={set('kasvu')} step={0.1} suffix="%" note="Liikevaihdon kasvuprosentti/kk" />
          </Section>

          <Section title="Muuttuvat kulut">
            <NI label="Ulkopuoliset palvelut" value={p.ulkopuoliset_pct} onChange={set('ulkopuoliset_pct')} step={0.5} suffix="%" note="Freelancerit/alihankkijat (% liikevaihdosta)" />
            <NI label="Ostot ja hankinnat" value={p.ostot_pct} onChange={set('ostot_pct')} step={0.5} suffix="%" note="Tavara- ja tarvikeostot (%)" />
          </Section>

          <Section title="Kiinteät kulut / kk">
            <NI label="Toimitilavuokrat" value={p.vuokrat} onChange={set('vuokrat')} step={500} />
            <NI label="Palkat + sivukulut" value={p.palkat} onChange={set('palkat')} step={500} />
            <NI label="ATK ja ohjelmistot" value={p.atk} onChange={set('atk')} step={200} />
            <NI label="Leasing ja laitteet" value={p.leasing} onChange={set('leasing')} step={200} />
            <NI label="Markkinointi" value={p.markkinointi} onChange={set('markkinointi')} step={200} />
            <NI label="Muut kiinteät" value={p.muut_kiinteat} onChange={set('muut_kiinteat')} step={200} />
          </Section>

          <Section title="Rahoitus">
            <NI label="Alkukassa (nyt)" value={p.alkukassa} onChange={set('alkukassa')} step={5000} note="Kassatilanne / rahat taseessa" />
            <NI label="Lainanlyhennykset / kk" value={p.lainanlyhennykset} onChange={set('lainanlyhennykset')} step={200} />
            <NI label="Rahoituskulut / kk" value={p.rahoituskulut} onChange={set('rahoituskulut')} step={100} note="Korot, provisiot" />
          </Section>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '.75rem' }}>
            <span style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)' }}>Ennustehorisontti</span>
            <div style={{ display: 'flex', gap: '.4rem', marginTop: '.5rem' }}>
              {[12, 24, 36].map(h => (
                <button key={h} className={`sub-tab${p.horisontti === h ? ' active' : ''}`}
                  style={{ flex: 1, fontSize: '.8rem', padding: '.35rem' }}
                  onClick={() => setP(prev => ({ ...prev, horisontti: h }))}>
                  {h} kk
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Oikea sarake ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* KPI-kortit */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))' }}>
            <div className="stat-card">
              <div className="stat-label">Loppukassa ({p.horisontti} kk)</div>
              <div className="stat-value" style={{ color: cashOk ? 'var(--green)' : RED }}>{fmt(kpis.loppukassa)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Ennusteen nettovoitto</div>
              <div className="stat-value" style={{ color: kpis.totalNet >= 0 ? 'var(--green)' : RED }}>{fmt(kpis.totalNet)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Kassavirta keskimäärin</div>
              <div className="stat-value" style={{ color: kpis.avgNet >= 0 ? 'var(--green)' : RED }}>{fmt(kpis.avgNet)}/kk</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Break-even</div>
              <div className="stat-value" style={{ color: kpis.breakEven ? 'var(--green)' : RED }}>
                {kpis.breakEven ? `kk ${kpis.breakEven}` : 'Ei saavuteta'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Kassan riittävyys</div>
              <div className="stat-value" style={{ color: kpis.runway === null ? 'var(--green)' : RED }}>
                {kpis.runway === null ? `>${p.horisontti} kk` : `${kpis.runway} kk`}
              </div>
            </div>
          </div>

          {/* Toteutuma + Ennuste yhdistetty */}
          {combinedData.length > 0 && (
            <div className="card" style={{ padding: '1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '.75rem', marginBottom: '.85rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', margin: 0 }}>
                  Toteutuma + Ennuste
                </h3>
                <div style={{ display: 'flex', gap: '.65rem', fontSize: '.7rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '.25rem', color: GREY }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: GREY, display: 'inline-block' }} />
                    Toteutunut ({actuals.length} kk)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '.25rem', color: VIOLET }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: VIOLET, display: 'inline-block' }} />
                    Ennuste ({p.horisontti} kk)
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={combinedData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }}
                    interval={combinedData.length > 20 ? Math.floor(combinedData.length / 10) : 0} />
                  <YAxis tickFormatter={n => (n / 1000).toFixed(0) + 'k'} tick={{ fontSize: 10 }} />
                  <Tooltip content={<EuroTip />} />
                  {actuals.length > 0 && (
                    <ReferenceLine x={combinedData[actuals.length - 1]?.label}
                      stroke="var(--border)" strokeWidth={2} strokeDasharray="4 2"
                      label={{ value: 'nyt', position: 'top', fontSize: 9, fill: 'var(--text3)' }} />
                  )}
                  <Bar dataKey="kassavirta_toteutunut" name="Toteutunut kassavirta" fill={GREY} radius={[3,3,0,0]} />
                  <Bar dataKey="kassavirta_ennuste"    name="Ennuste kassavirta"    fill={VIOLET} radius={[3,3,0,0]} fillOpacity={0.75} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Toteutunut liikevaihto kuukausittain */}
          {actuals.length > 0 && (
            <div className="card" style={{ padding: '1.1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', margin: '0 0 .75rem' }}>
                Toteutunut liikevaihto ja tulos
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart
                  data={actuals.map(r => ({
                    label:      MONTH_LABELS[r.period] || r.period,
                    liikevaihto: Math.round(r.liikevaihto || 0),
                    tulos:       Math.round(r.tilikauden_voitto || 0),
                  }))}
                  margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={n => (n / 1000).toFixed(0) + 'k'} tick={{ fontSize: 10 }} />
                  <Tooltip content={<EuroTip />} />
                  <Legend wrapperStyle={{ fontSize: '.73rem' }} />
                  <Bar dataKey="liikevaihto" name="Liikevaihto" fill={GREEN}  radius={[3,3,0,0]} fillOpacity={0.85} />
                  <Line type="monotone" dataKey="tulos" name="Tilikauden tulos" stroke={VIOLET} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Kulujakauma */}
          <div className="card" style={{ padding: '1.1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', margin: '0 0 .75rem' }}>
              Kulurakenne (enn. kk 1) — yhteensä {fmt(totalCosts0)}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
              {breakdown.map(b => {
                const pct = totalCosts0 > 0 ? (b.value / totalCosts0) * 100 : 0
                return (
                  <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: b.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '.78rem', color: 'var(--text2)', width: 160, flexShrink: 0 }}>{b.name}</span>
                    <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: b.color, borderRadius: 4, transition: 'width .3s' }} />
                    </div>
                    <span style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text)', width: 72, textAlign: 'right', flexShrink: 0 }}>{fmt(b.value)}</span>
                    <span style={{ fontSize: '.72rem', color: 'var(--text3)', width: 36, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(0)} %</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Kumulatiivinen kassatilanne (ennuste) */}
          <div className="card" style={{ padding: '1.1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', margin: '0 0 .75rem' }}>
              Kumulatiivinen kassatilanne (ennuste, alkaen {fmt(p.alkukassa)})
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={months} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="kasGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={VIOLET} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={VIOLET} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={n => (n / 1000).toFixed(0) + 'k'} tick={{ fontSize: 10 }} />
                <Tooltip content={<EuroTip />} />
                <ReferenceLine y={0} stroke={RED} strokeDasharray="3 3" strokeWidth={1} />
                <Area type="monotone" dataKey="kumulatiivinen" name="Kumulatiivinen kassa"
                  stroke={VIOLET} fill="url(#kasGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Liikevaihto vs kulut — ennuste */}
          <div className="card" style={{ padding: '1.1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', margin: '0 0 .75rem' }}>Liikevaihto vs. kulurakenne (ennuste)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={months} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={n => (n / 1000).toFixed(0) + 'k'} tick={{ fontSize: 10 }} />
                <Tooltip content={<EuroTip />} />
                <Legend wrapperStyle={{ fontSize: '.73rem' }} />
                <Bar dataKey="ulkopuoliset" name="Ulkopuoliset palv." stackId="kulut" fill={ROSE}    radius={[0,0,0,0]} />
                <Bar dataKey="ostot"         name="Ostot"             stackId="kulut" fill="#0891B2"  radius={[0,0,0,0]} />
                <Bar dataKey="kiinteat"      name="Kiinteät kulut"    stackId="kulut" fill={AMBER}    radius={[0,0,0,0]} />
                <Bar dataKey="rahoitus"      name="Rahoitus"          stackId="kulut" fill="#64748B"  radius={[3,3,0,0]} />
                <Line type="monotone" dataKey="liikevaihto" name="Liikevaihto" stroke={GREEN} strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Kuukausittainen kassavirta — ennuste */}
          <div className="card" style={{ padding: '1.1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', margin: '0 0 .75rem' }}>Kuukausittainen kassavirta (ennuste)</h3>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={months} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={n => (n / 1000).toFixed(0) + 'k'} tick={{ fontSize: 10 }} />
                <Tooltip content={<EuroTip />} />
                <Bar dataKey="kassavirta" name="Kassavirta" fill={VIOLET} radius={[3, 3, 0, 0]}
                  shape={props => {
                    const { x, y, width, height, value } = props
                    const color = value >= 0 ? GREEN : RED
                    const barY  = value >= 0 ? y : y + height
                    return <rect x={x} y={barY} width={width} height={Math.abs(height)} fill={color} rx={3} />
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Taulukko */}
          <div className="card" style={{ padding: '1.1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', margin: '0 0 .75rem' }}>Kuukausittaiset ennusteluvut</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kk</th><th>Liikevaihto</th><th>Ulkopuol.</th>
                    <th>Kiinteät</th><th>Kulut yht.</th><th>Kassavirta</th><th>Kumulat.</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map(m => (
                    <tr key={m.kk}>
                      <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{m.label}</td>
                      <td style={{ fontWeight: 600, color: GREEN }}>{fmt(m.liikevaihto)}</td>
                      <td style={{ color: ROSE,  fontSize: '.8rem' }}>{fmt(m.ulkopuoliset)}</td>
                      <td style={{ color: AMBER, fontSize: '.8rem' }}>{fmt(m.kiinteat)}</td>
                      <td style={{ color: RED,   fontSize: '.8rem' }}>{fmt(m.totalCosts)}</td>
                      <td style={{ fontWeight: 700, color: m.kassavirta >= 0 ? GREEN : RED }}>
                        {m.kassavirta >= 0 ? '+' : ''}{fmt(m.kassavirta)}
                      </td>
                      <td style={{ fontWeight: 700, color: m.kumulatiivinen >= 0 ? VIOLET : RED }}>
                        {fmt(m.kumulatiivinen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
