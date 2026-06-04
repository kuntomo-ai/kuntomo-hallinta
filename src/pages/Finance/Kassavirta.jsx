import { useRef, useState } from 'react'
import {
  ComposedChart, AreaChart, Area, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Download, Upload, FileText, FileSpreadsheet, ChevronDown, ChevronUp } from 'lucide-react'
import KirjanpitoNav from '../../components/KirjanpitoNav'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Oletusarvot: Kuntomo Oy tilinpäätös 1.5.2025–30.4.2026 ──────────────────
// LV 1 919 009 €/v → ~159 917/kk | Ulkopuoliset 886 745 € = 46 % LV:stä
// Rahat 30.4.2026: 176 831 € | Henkilöstö 87 955 €/v → 7 330/kk
const DEFAULTS = {
  alkukassa:        177000,  // rahat ja pankkisaamiset 30.4.2026
  liikevaihto:      160000,  // 1 919 009 / 12
  muut_tuotot:        9200,  // 110 398 / 12
  kasvu:               2.0,
  // Muuttuvat kulut
  ulkopuoliset_pct:   46.2,  // 886 745 / 1 919 009
  ostot_pct:           2.4,  // (48 440 - 2 622) / 1 919 009
  // Kiinteät kulut
  vuokrat:           28000,
  palkat:             7330,  // 87 955 / 12
  atk:                5700,
  leasing:            2500,
  markkinointi:       2100,
  muut_kiinteat:      9500,  // jäännös liiketoiminnan muista kuluista
  // Rahoitus
  lainanlyhennykset:  5400,
  rahoituskulut:      1270,  // 15 225 / 12
  // Horisontti
  horisontti:           12,
}

function fmt(n, decimals = 0) {
  const abs = Math.abs(n)
  const str = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: decimals }).format(abs) + ' €'
  return n < 0 ? `−${str}` : str
}

function calcMonths(p) {
  const months = []
  let cumulative = p.alkukassa
  for (let i = 0; i < p.horisontti; i++) {
    const revenue    = (p.liikevaihto + p.muut_tuotot) * Math.pow(1 + p.kasvu / 100, i)
    const liikevaihto_only = p.liikevaihto * Math.pow(1 + p.kasvu / 100, i)
    const ulkopuoliset = liikevaihto_only * (p.ulkopuoliset_pct / 100)
    const ostot      = liikevaihto_only * (p.ostot_pct / 100)
    const kiinteat   = p.vuokrat + p.palkat + p.atk + p.leasing + p.markkinointi + p.muut_kiinteat
    const rahoitus   = p.lainanlyhennykset + p.rahoituskulut
    const totalCosts = ulkopuoliset + ostot + kiinteat + rahoitus
    const netCash    = revenue - totalCosts
    cumulative      += netCash
    months.push({
      kk:             i + 1,
      label:          `kk ${i + 1}`,
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
  const loppukassa   = months[months.length - 1].kumulatiivinen
  const avgNet       = Math.round(months.reduce((s, m) => s + m.kassavirta, 0) / months.length)
  const totalNet     = months.reduce((s, m) => s + m.kassavirta, 0)
  return { breakEven, runway, loppukassa, avgNet, totalNet }
}

// ── Pieni syöttökenttä ───────────────────────────────────────────────────────
function NI({ label, value, onChange, suffix = '€', step = 100, note }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
      <label style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text2)', letterSpacing: '.02em' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
        <input
          className="input-field"
          type="number" step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1, fontSize: '.85rem', padding: '.35rem .6rem', height: 'auto' }}
        />
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

function EuroTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '.55rem .85rem', fontSize: '.76rem', minWidth: 180 }}>
      <div style={{ fontWeight: 700, marginBottom: '.3rem', color: 'var(--text)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>{p.name}</span>
          <strong>{fmt(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function Kassavirta() {
  const [p, setP] = useState(DEFAULTS)
  const fileRef   = useRef(null)

  const set = key => val => setP(prev => ({ ...prev, [key]: val }))

  const months = calcMonths(p)
  const kpis   = calcKPIs(months)

  // ── Viennit ──────────────────────────────────────────────────────────────────

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
    const lines = [
      `Alkukassa: ${fmt(p.alkukassa)}  |  Liikevaihto: ${fmt(p.liikevaihto)}/kk  |  Muut tuotot: ${fmt(p.muut_tuotot)}/kk  |  Kasvu: ${p.kasvu} %/kk`,
      `Ulkopuoliset palv.: ${p.ulkopuoliset_pct} % liikevaihdosta  |  Ostot: ${p.ostot_pct} %`,
      `Vuokrat: ${fmt(p.vuokrat)}/kk  |  Palkat: ${fmt(p.palkat)}/kk  |  ATK: ${fmt(p.atk)}/kk  |  Leasing: ${fmt(p.leasing)}/kk`,
      `Markkinointi: ${fmt(p.markkinointi)}/kk  |  Muut kiinteät: ${fmt(p.muut_kiinteat)}/kk  |  Lainanlyhennykset: ${fmt(p.lainanlyhennykset)}/kk`,
    ]
    lines.forEach((l, i) => doc.text(l, 14, 24 + i * 5))
    autoTable(doc, {
      startY: 46,
      head: [['Kk', 'Liikevaihto', 'Ulkopuoliset', 'Ostot', 'Kiinteät', 'Rahoitus', 'Kassavirta', 'Kumulat.']],
      body: months.map(m => [m.label, fmt(m.liikevaihto), fmt(m.ulkopuoliset), fmt(m.ostot), fmt(m.kiinteat), fmt(m.rahoitus), fmt(m.kassavirta), fmt(m.kumulatiivinen)]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [124, 58, 237] },
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

  const cashOk = kpis.loppukassa >= 0

  // Kulujakauma piirakkamainen breakdown nykyparametreillä (kk 1)
  const m0 = months[0]
  const breakdown = [
    { name: 'Ulkopuoliset palv.', value: m0.ulkopuoliset, color: ROSE },
    { name: 'Vuokrat',             value: p.vuokrat,       color: AMBER },
    { name: 'Palkat',              value: p.palkat,        color: BLUE },
    { name: 'ATK + leasing',       value: p.atk + p.leasing, color: '#8B5CF6' },
    { name: 'Ostot',               value: m0.ostot,        color: '#0891B2' },
    { name: 'Markkinointi + muut', value: p.markkinointi + p.muut_kiinteat, color: '#059669' },
    { name: 'Lainanlyhennykset',   value: p.lainanlyhennykset + p.rahoituskulut, color: '#64748B' },
  ]
  const totalCosts0 = breakdown.reduce((s, b) => s + b.value, 0)

  return (
    <div>
      <KirjanpitoNav />
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Kassavirta</h1>
          <p className="page-subtitle">Kassavirta-ennuste · oletukset kirjanpidosta (touko 2025 – huhtikuu 2026)</p>
        </div>
        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
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
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.92rem', margin: 0 }}>Parametrit</h3>

          <Section title="Tulot">
            <NI label="Liikevaihto / kk" value={p.liikevaihto} onChange={set('liikevaihto')} step={1000} note="Myynnistä saatava liikevaihto" />
            <NI label="Muut tuotot / kk" value={p.muut_tuotot} onChange={set('muut_tuotot')} step={500} note="Vuokratuotot ym. (~7 800 €/kk)" />
            <NI label="Kuukausikasvu" value={p.kasvu} onChange={set('kasvu')} step={0.1} suffix="%" note="Liikevaihdon kasvuprosentti/kk" />
          </Section>

          <Section title="Muuttuvat kulut">
            <NI label="Ulkopuoliset palvelut" value={p.ulkopuoliset_pct} onChange={set('ulkopuoliset_pct')} step={0.5} suffix="%" note="Freelancerit/alihankkijat (~42 % liikevaihdosta)" />
            <NI label="Ostot ja hankinnat" value={p.ostot_pct} onChange={set('ostot_pct')} step={0.5} suffix="%" note="Tavara- ja tarvikeostot (~2,7 %)" />
          </Section>

          <Section title="Kiinteät kulut / kk">
            <NI label="Toimitilavuokrat" value={p.vuokrat} onChange={set('vuokrat')} step={500} note="Kempele + Etu-Lyötty" />
            <NI label="Palkat + sivukulut" value={p.palkat} onChange={set('palkat')} step={500} />
            <NI label="ATK ja ohjelmistot" value={p.atk} onChange={set('atk')} step={200} />
            <NI label="Leasing ja laitteet" value={p.leasing} onChange={set('leasing')} step={200} />
            <NI label="Markkinointi" value={p.markkinointi} onChange={set('markkinointi')} step={200} />
            <NI label="Muut kiinteät" value={p.muut_kiinteat} onChange={set('muut_kiinteat')} step={200} />
          </Section>

          <Section title="Rahoitus">
            <NI label="Alkukassa" value={p.alkukassa} onChange={set('alkukassa')} step={5000} note="Kassatilanne huhtikuu 2026" />
            <NI label="Lainanlyhennykset / kk" value={p.lainanlyhennykset} onChange={set('lainanlyhennykset')} step={200} note="Lainaa jäljellä ~181 000 €" />
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

          {/* Kulujakauma kk 1 */}
          <div className="card" style={{ padding: '1.1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', margin: '0 0 .75rem' }}>
              Kulurakenne (kk 1) — yhteensä {fmt(totalCosts0)}
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

          {/* Kassakäyrä */}
          <div className="card" style={{ padding: '1.1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', margin: '0 0 .75rem' }}>Kumulatiivinen kassatilanne</h3>
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
                <Area type="monotone" dataKey="kumulatiivinen" name="Kumulatiivinen kassa"
                  stroke={VIOLET} fill="url(#kasGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Liikevaihto vs kulut — pinottuna */}
          <div className="card" style={{ padding: '1.1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', margin: '0 0 .75rem' }}>Liikevaihto vs. kulurakenne</h3>
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

          {/* Kuukausittainen kassavirta */}
          <div className="card" style={{ padding: '1.1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', margin: '0 0 .75rem' }}>Kuukausittainen kassavirta</h3>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={months} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={n => (n / 1000).toFixed(0) + 'k'} tick={{ fontSize: 10 }} />
                <Tooltip content={<EuroTip />} />
                <Bar dataKey="kassavirta" name="Kassavirta"
                  fill={VIOLET} radius={[3, 3, 0, 0]}
                  label={false}
                  // positiiviset vihreinä, negatiiviset punaisina
                  shape={props => {
                    const { x, y, width, height, value } = props
                    const color = value >= 0 ? GREEN : RED
                    const barY  = value >= 0 ? y : y + height
                    const barH  = Math.abs(height)
                    return <rect x={x} y={barY} width={width} height={barH} fill={color} rx={3} />
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Taulukko */}
          <div className="card" style={{ padding: '1.1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', margin: '0 0 .75rem' }}>Kuukausittaiset luvut</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kk</th>
                    <th>Liikevaihto</th>
                    <th>Ulkopuol.</th>
                    <th>Kiinteät</th>
                    <th>Kulut yht.</th>
                    <th>Kassavirta</th>
                    <th>Kumulat.</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map(m => (
                    <tr key={m.kk}>
                      <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{m.label}</td>
                      <td style={{ fontWeight: 600, color: GREEN }}>{fmt(m.liikevaihto)}</td>
                      <td style={{ color: ROSE, fontSize: '.8rem' }}>{fmt(m.ulkopuoliset)}</td>
                      <td style={{ color: AMBER, fontSize: '.8rem' }}>{fmt(m.kiinteat)}</td>
                      <td style={{ color: RED, fontSize: '.8rem' }}>{fmt(m.totalCosts)}</td>
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
    </div>
  )
}
