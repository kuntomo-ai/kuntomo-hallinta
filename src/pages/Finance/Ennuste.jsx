import { useEffect, useState, Fragment, memo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { supabaseAdmin } from '../../lib/supabase'
import KirjanpitoNav from '../../components/KirjanpitoNav'

// ─── Row definitions ─────────────────────────────────────────────────────────

const T2_ROWS = [
  { id: 'liikevaihto',          label: '1    Liikevaihto',                  input: true              },
  { id: 'muut_tuotot',          label: '2    Liiketoiminnan muut tuotot',    input: true              },
  { id: 'tuotot_yht',           label: '3    LIIKETOIMINNAN TUOTOT YHT.',    calc:  true, level: 1    },
  { id: 'materiaalit_palvelut', label: '4    Materiaalit ja palvelut',       input: true, cost: true  },
  { id: 'henkilostokulut',      label: '5    Henkilöstökulut',               input: true, cost: true  },
  { id: 'muut_kulut',           label: '6    Liiketoiminnan muut kulut',     input: true, cost: true  },
  { id: 'varasto_muutos',       label: '7    Valmistevaraston muutos +/-',   input: true              },
  { id: 'kayttokate',           label: '8    KÄYTTÖKATE',                    calc:  true, level: 1    },
  { id: 'poistot',              label: '9    Poistot',                       input: true, cost: true  },
  { id: 'liiketulos',           label: '10   LIIKETULOS',                    calc:  true, level: 2    },
  { id: 'rahoitustuotot',       label: '11   Rahoitustuotot (netto)',        input: true              },
  { id: 'korkokulut',           label: '12   Korkokulut',                    input: true, cost: true  },
  { id: 'verot',                label: '13   Välittömät verot',              input: true, cost: true  },
  { id: 'nettotulos',           label: '14   NETTOTULOS',                    calc:  true, level: 2    },
  { id: 'satunnaiset_erat',     label: '15   Satunnaiset erät (netto)',      input: true              },
  { id: 'kokonaistulos',        label: '16   KOKONAISTULOS',                calc:  true, level: 3    },
]

const INPUT_KEYS = T2_ROWS.filter(r => r.input).map(r => r.id)
const T4_KEYS    = ['investoinnit', 'uudet_lainat', 'lainojen_lyhennys', 'osingonjako', 'omistajien_sijoitus']
const ALL_KEYS   = [...INPUT_KEYS, ...T4_KEYS]
const PERIODS    = ['e1', 'e2', 'e3']
const P_LABELS   = { e1: 'Ennuste 1 (12 kk)', e2: 'Ennuste 2 (24 kk)', e3: 'Ennuste 3 (36 kk)' }
const CALC_BG    = [
  'color-mix(in srgb, var(--violet) 5%, var(--bg1))',
  'color-mix(in srgb, var(--violet) 9%, var(--bg1))',
  'color-mix(in srgb, var(--violet) 14%, var(--bg1))',
]

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function fmt(v) {
  if (v == null || isNaN(v)) return '—'
  const n = Math.round(v)
  return (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('fi-FI') + ' €'
}

function pct(val, base) {
  if (!base || isNaN(val)) return ''
  return ((val / base) * 100).toFixed(1) + ' %'
}

function calcValues(inp) {
  const g   = k => inp[k] ?? 0
  const lv  = g('liikevaihto'), muut = g('muut_tuotot')
  const mat = g('materiaalit_palvelut'), henk = g('henkilostokulut')
  const mk  = g('muut_kulut'),  var_ = g('varasto_muutos')
  const poi = g('poistot'),     rf   = g('rahoitustuotot')
  const ko  = g('korkokulut'),  ve   = g('verot'),  sat = g('satunnaiset_erat')

  const tuotot_yht    = lv + muut
  const kayttokate    = tuotot_yht - mat - henk - mk + var_
  const liiketulos    = kayttokate - poi
  const nettotulos    = liiketulos + rf - ko - ve
  const kokonaistulos = nettotulos + sat

  return { ...inp, tuotot_yht, kayttokate, liiketulos, nettotulos, kokonaistulos }
}

function deriveAuto(monthRows, taseLoans = []) {
  const sorted = [...monthRows].sort((a, b) => b.period.localeCompare(a.period)).slice(0, 12)
  if (!sorted.length) return { actuals: {}, auto: { e1: {}, e2: {}, e3: {} }, growth: 0 }

  const sumAbs = k => sorted.reduce((s, r) => s + Math.abs(r[k] || 0), 0)
  const sumPos = k => sorted.reduce((s, r) => s + (r[k] || 0), 0)

  const act = {
    liikevaihto:          Math.round(sumPos('liikevaihto')),
    muut_tuotot:          Math.round(sumPos('muut_tuotot')),
    materiaalit_palvelut: Math.round(sumAbs('materiaalit_palvelut')),
    henkilostokulut:      Math.round(sumAbs('henkilostokulut')),
    muut_kulut:           Math.round(sumAbs('muut_kulut')),
    varasto_muutos:       0,
    poistot:              Math.round(sumAbs('poistot')),
    rahoitustuotot: 0, verot: 0, satunnaiset_erat: 0,
  }

  // Derive korkokulut+verot from difference: tilikauden_voitto vs computed liiketulos
  const compLiiketulos = (act.liikevaihto + act.muut_tuotot)
    - act.materiaalit_palvelut - act.henkilostokulut - act.muut_kulut - act.poistot
  const sumTilik  = Math.round(sumPos('tilikauden_voitto'))
  const netBelow  = sumTilik - compLiiketulos
  act.korkokulut  = Math.round(Math.max(0, -netBelow))

  // T4: annual loan repayment from tase 282x (lyhennyserät)
  const annualLyhennys = Math.round(
    taseLoans.filter(l => l.account_code?.startsWith('282'))
      .reduce((s, l) => s + Math.abs(l.loppusaldo || 0), 0)
  )

  const half   = Math.ceil(sorted.length / 2)
  const avgNew = sorted.slice(0, half).reduce((s, r) => s + (r.liikevaihto || 0), 0) / half
  const avgOld = sorted.slice(half).reduce((s, r) => s + (r.liikevaihto || 0), 0) / Math.max(1, sorted.length - half)
  const growth = Math.max(-0.15, Math.min(0.25, avgOld > 0 ? avgNew / avgOld - 1 : 0))

  const proj = m => ({
    liikevaihto:          Math.round(act.liikevaihto * m),
    muut_tuotot:          Math.round(act.muut_tuotot * m),
    materiaalit_palvelut: Math.round(act.materiaalit_palvelut * m),
    henkilostokulut:      Math.round(act.henkilostokulut * m),
    muut_kulut:           Math.round(act.muut_kulut * m),
    varasto_muutos: 0, poistot: act.poistot,
    rahoitustuotot: 0, korkokulut: act.korkokulut, verot: 0, satunnaiset_erat: 0,
    lainojen_lyhennys: annualLyhennys,
  })

  return {
    actuals: act,
    auto: { e1: proj(1 + growth), e2: proj((1 + growth) ** 2), e3: proj((1 + growth) ** 3) },
    growth: Math.round(growth * 100),
  }
}

// ─── CellInput ────────────────────────────────────────────────────────────────

const CellInput = memo(function CellInput({ autoVal, manualVal, onSave }) {
  const [draft, setDraft] = useState(null)
  const isManual = manualVal != null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <input
        type="number"
        step="1"
        value={draft !== null ? draft : (isManual ? manualVal : '')}
        placeholder={autoVal != null ? String(Math.round(autoVal)) : '0'}
        onChange={e => setDraft(e.target.value)}
        onFocus={() => { if (draft === null) setDraft(isManual ? String(manualVal) : '') }}
        onBlur={() => {
          const v = String(draft ?? '').trim()
          if (v === '') { if (isManual) onSave(null) }
          else { const n = parseFloat(v.replace(',', '.')); if (!isNaN(n)) onSave(n) }
          setDraft(null)
        }}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
        style={{
          width: 106, padding: '3px 6px', fontFamily: 'monospace', fontSize: '.78rem',
          textAlign: 'right', borderRadius: 5, outline: 'none',
          border: `1px solid ${isManual ? 'var(--violet)' : 'var(--border)'}`,
          background: isManual ? 'color-mix(in srgb, var(--violet) 7%, var(--bg1))' : 'transparent',
          color: isManual ? 'var(--violet)' : 'var(--text3)',
        }}
      />
      {isManual
        ? <button onClick={() => onSave(null)} title="Palauta automaattinen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '.7rem', padding: '0 2px', lineHeight: 1 }}>×</button>
        : <span style={{ fontSize: '.6rem', color: 'var(--text3)', width: 12, textAlign: 'center' }} title="Automaattinen arvio">A</span>
      }
    </div>
  )
})

// ─── T4 Tab ───────────────────────────────────────────────────────────────────

function T4Tab({ r, manual, auto, saveCell }) {
  function t4(p) {
    const g = k => manual[p]?.[k] ?? auto[p]?.[k] ?? 0
    const inv  = g('investoinnit'), uusi = g('uudet_lainat')
    const lyh  = g('lainojen_lyhennys'), osing = g('osingonjako')
    const oms  = g('omistajien_sijoitus')
    const kassvirt    = (r[p].nettotulos || 0) + (r[p].poistot || 0)
    const lahteet_yht = kassvirt + uusi + oms
    const kaytto_yht  = inv + lyh + osing
    return { kassvirt, lahteet_yht, kaytto_yht, kassajaama: lahteet_yht - kaytto_yht }
  }

  const th = { textAlign: 'right', padding: '7px 12px', fontWeight: 700, minWidth: 180 }
  const td = { padding: '5px 12px', fontSize: '.82rem', borderBottom: '1px solid var(--border)' }
  const sec = { ...td, background: 'var(--bg2)', fontWeight: 700, fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text3)', paddingTop: 8 }

  const InputRow = ({ label, k }) => (
    <tr>
      <td style={td}>{label}</td>
      {PERIODS.map(p => (
        <td key={p} style={{ ...td, padding: '3px 8px' }}>
          <CellInput autoVal={auto[p]?.[k] ?? 0} manualVal={manual[p]?.[k] ?? null} onSave={v => saveCell(p, k, v)} />
        </td>
      ))}
    </tr>
  )

  return (
    <div className="card" style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, minWidth: 280 }}>Erä</th>
            {PERIODS.map(p => <th key={p} style={th}>{P_LABELS[p]}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr><td colSpan={4} style={sec}>Rahan lähteet</td></tr>

          <tr>
            <td style={td}>Nettotulos + poistot (T2:sta)</td>
            {PERIODS.map(p => <td key={p} style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: 'var(--text2)' }}>{fmt(t4(p).kassvirt)}</td>)}
          </tr>
          <InputRow label="Uudet lainat" k="uudet_lainat" />
          <InputRow label="Omistajien lisäsijoitukset" k="omistajien_sijoitus" />

          <tr style={{ background: 'color-mix(in srgb, var(--green) 6%, var(--bg1))', borderTop: '1px solid var(--border)' }}>
            <td style={{ ...td, fontWeight: 800 }}>LÄHTEET YHTEENSÄ</td>
            {PERIODS.map(p => <td key={p} style={{ ...td, textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: 'var(--green)' }}>{fmt(t4(p).lahteet_yht)}</td>)}
          </tr>

          <tr><td colSpan={4} style={{ ...sec, paddingTop: 12 }}>Rahan käyttö</td></tr>

          <InputRow label="Investoinnit" k="investoinnit" />
          <InputRow label="Lainojen lyhennys" k="lainojen_lyhennys" />
          <InputRow label="Osingonjako / yksityiskäyttö" k="osingonjako" />

          <tr style={{ background: 'color-mix(in srgb, var(--red) 6%, var(--bg1))', borderTop: '1px solid var(--border)' }}>
            <td style={{ ...td, fontWeight: 800 }}>KÄYTTÖ YHTEENSÄ</td>
            {PERIODS.map(p => <td key={p} style={{ ...td, textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: 'var(--red)' }}>{fmt(t4(p).kaytto_yht)}</td>)}
          </tr>

          <tr style={{ background: CALC_BG[2], borderTop: '2px solid var(--violet)' }}>
            <td style={{ ...td, fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '.04em', fontSize: '.9rem' }}>KASSAJÄÄMÄ</td>
            {PERIODS.map(p => {
              const jm = t4(p).kassajaama
              return <td key={p} style={{ ...td, textAlign: 'right', fontWeight: 900, fontFamily: 'monospace', fontSize: '.92rem', color: jm < 0 ? 'var(--red)' : 'var(--violet)' }}>{fmt(jm)}</td>
            })}
          </tr>
        </tbody>
      </table>
      <p style={{ padding: '.6rem 1rem', fontSize: '.7rem', color: 'var(--text3)', borderTop: '1px solid var(--border)', margin: 0 }}>
        Nettotulos + poistot lasketaan automaattisesti T2:sta. Muut rivit syötetään käsin.
      </p>
    </div>
  )
}

// ─── T7 Tab ───────────────────────────────────────────────────────────────────

const EMPTY_LOAN = { luotonantaja: '', lainamaara: 0, laina_aika_v: 5, korko_pct: 0, is_new: false, sort_order: 0 }

function T7Tab({ loans, setLoans, taseLoans }) {
  const [editId, setEditId] = useState(null)
  const [form, setForm]     = useState(EMPTY_LOAN)

  const current  = loans.filter(l => !l.is_new)
  const newLoans = loans.filter(l => l.is_new)

  const inp = (field, type = 'text', extra = {}) => (
    <input
      type={type}
      value={form[field]}
      onChange={e => setForm(f => ({ ...f, [field]: type === 'number' ? +e.target.value : e.target.value }))}
      style={{ width: type === 'text' ? '100%' : 80, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '.78rem', textAlign: type === 'number' ? 'right' : 'left', background: 'var(--bg1)', color: 'var(--text)', ...extra }}
    />
  )

  async function addLoan(isNew, prefill = {}) {
    const row = { ...EMPTY_LOAN, ...prefill, is_new: isNew, sort_order: loans.length }
    const { data, error } = await supabaseAdmin.from('ennuste_lainat').insert(row).select().single()
    if (!error && data) { setLoans(ls => [...ls, data]); setEditId(data.id); setForm(data) }
  }

  async function saveLoan() {
    if (!editId) return
    await supabaseAdmin.from('ennuste_lainat').update(form).eq('id', editId)
    setLoans(ls => ls.map(l => l.id === editId ? { ...l, ...form } : l))
    setEditId(null)
  }

  async function deleteLoan(id) {
    await supabaseAdmin.from('ennuste_lainat').delete().eq('id', id)
    setLoans(ls => ls.filter(l => l.id !== id))
  }

  const tdS = { padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: '.8rem' }

  function LoanRow({ loan }) {
    const lyh   = loan.laina_aika_v > 0 ? Math.round(loan.lainamaara / loan.laina_aika_v) : 0
    const korko = Math.round((loan.lainamaara || 0) * (loan.korko_pct || 0) / 100)
    const isEd  = editId === loan.id
    return (
      <tr>
        <td style={tdS}>{isEd ? inp('luotonantaja') : (loan.luotonantaja || <span style={{ color: 'var(--text3)' }}>—</span>)}</td>
        <td style={{ ...tdS, textAlign: 'right' }}>{isEd ? inp('lainamaara', 'number') : <span style={{ fontFamily: 'monospace' }}>{fmt(loan.lainamaara)}</span>}</td>
        <td style={{ ...tdS, textAlign: 'right' }}>{isEd ? inp('laina_aika_v', 'number', { width: 56 }) : `${loan.laina_aika_v} v`}</td>
        <td style={{ ...tdS, textAlign: 'right' }}>{isEd ? inp('korko_pct', 'number', { width: 60 }) : `${loan.korko_pct} %`}</td>
        <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace', color: 'var(--text2)' }}>{fmt(lyh)}</td>
        <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace', color: 'var(--red)' }}>{fmt(korko)}</td>
        <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
          {isEd ? (
            <>
              <button onClick={saveLoan} style={{ background: 'var(--violet)', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontSize: '.75rem', marginRight: 4 }}>Tallenna</button>
              <button onClick={() => setEditId(null)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: '.75rem', color: 'var(--text3)' }}>Peru</button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditId(loan.id); setForm(loan) }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: '.75rem', color: 'var(--text2)', marginRight: 4 }}>Muokkaa</button>
              <button onClick={() => deleteLoan(loan.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.75rem', color: 'var(--red)' }}>Poista</button>
            </>
          )}
        </td>
      </tr>
    )
  }

  function TotalRow({ lns }) {
    const totMaara = lns.reduce((s, l) => s + (l.lainamaara || 0), 0)
    const totLyh   = lns.reduce((s, l) => s + (l.laina_aika_v > 0 ? Math.round(l.lainamaara / l.laina_aika_v) : 0), 0)
    const totKorko = lns.reduce((s, l) => s + Math.round((l.lainamaara || 0) * (l.korko_pct || 0) / 100), 0)
    return (
      <tr style={{ background: 'var(--bg2)', fontWeight: 800 }}>
        <td style={{ padding: '6px 10px', fontSize: '.8rem' }}>Yhteensä</td>
        <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '.8rem' }}>{fmt(totMaara)}</td>
        <td /><td />
        <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '.8rem' }}>{fmt(totLyh)}</td>
        <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '.8rem', color: 'var(--red)' }}>{fmt(totKorko)}</td>
        <td />
      </tr>
    )
  }

  const thead = (
    <tr style={{ borderBottom: '2px solid var(--border)' }}>
      {['Luotonantaja', 'Lainamäärä', 'Laina-aika', 'Korko %', 'Lyhennys/v', 'Korko/v', ''].map((h, i) => (
        <th key={i} style={{ textAlign: i >= 1 && i <= 5 ? 'right' : 'left', padding: '7px 10px', fontSize: '.78rem', fontWeight: 700, minWidth: i === 0 ? 160 : i <= 3 ? 90 : 110 }}>{h}</th>
      ))}
    </tr>
  )

  function Section({ title, lns, isNew }) {
    return (
      <div className="card" style={{ overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1rem .5rem' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.9rem' }}>{title}</span>
          <button onClick={() => addLoan(isNew)} style={{ background: 'var(--violet)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '.78rem', fontWeight: 600 }}>+ Lisää laina</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>{thead}</thead>
          <tbody>
            {lns.map(l => <LoanRow key={l.id} loan={l} />)}
            {lns.length === 0 && <tr><td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text3)', fontSize: '.82rem' }}>Ei lainoja. Lisää painikkeesta.</td></tr>}
            <TotalRow lns={lns} />
          </tbody>
        </table>
      </div>
    )
  }

  // Kirjanpidosta haetut lainat (read-only)
  const taseTotal = taseLoans.reduce((s, l) => s + (l.loppusaldo || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Kirjanpidosta haetut lainat */}
      {taseLoans.length > 0 && (
        <div className="card" style={{ overflow: 'auto', borderLeft: '3px solid var(--violet)' }}>
          <div style={{ padding: '1rem 1rem .5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.9rem' }}>Nykyiset lainat</span>
              <span style={{ marginLeft: '.6rem', fontSize: '.72rem', fontWeight: 600, color: 'var(--violet)', background: 'color-mix(in srgb, var(--violet) 10%, var(--bg1))', padding: '.2rem .55rem', borderRadius: 10 }}>
                Kirjanpidosta (tase)
              </span>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Tili', 'Nimi', 'Saldo (€)', 'Tyyppi', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: i >= 2 && i <= 3 ? 'right' : 'left', padding: '7px 10px', fontSize: '.78rem', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {taseLoans.map(r => (
                <tr key={r.account_code} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 10px', fontSize: '.75rem', fontFamily: 'monospace', color: 'var(--text3)' }}>{r.account_code}</td>
                  <td style={{ padding: '6px 10px', fontSize: '.82rem' }}>{r.account_name}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '.82rem', fontWeight: 600, color: r.loppusaldo < 0 ? 'var(--red)' : 'var(--text)' }}>
                    {Math.abs(r.loppusaldo).toLocaleString('fi-FI', { maximumFractionDigits: 2 })} €
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: '.72rem', color: 'var(--text3)' }}>
                    {r.sub_section === 'vieras_pit' ? 'Pitkäaikainen' : 'Lyhytaikainen'}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <button
                      onClick={() => addLoan(false, { luotonantaja: r.account_name, lainamaara: Math.abs(r.loppusaldo) })}
                      title="Lisää muokattavaksi"
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontSize: '.72rem', color: 'var(--text2)', whiteSpace: 'nowrap' }}
                    >
                      + Muokkaa
                    </button>
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--bg2)', fontWeight: 800, borderTop: '2px solid var(--border)' }}>
                <td colSpan={2} style={{ padding: '6px 10px', fontSize: '.8rem' }}>Yhteensä</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '.8rem' }}>
                  {taseTotal.toLocaleString('fi-FI', { maximumFractionDigits: 2 })} €
                </td>
                <td /><td />
              </tr>
            </tbody>
          </table>
          <p style={{ margin: 0, padding: '.5rem 1rem', fontSize: '.7rem', color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
            Haettu automaattisesti viimeisimmästä tase-snapshotista. Paina "+ Muokkaa" lisätäksesi laina-ajan ja koron.
          </p>
        </div>
      )}

      <Section title="Muokattavat lainat (nykyiset)" lns={current}  isNew={false} />
      <Section title="Uudet lainat"                  lns={newLoans} isNew={true}  />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Ennuste() {
  const [monthData, setMonthData] = useState([])
  const [manual,    setManual]    = useState({ e1: {}, e2: {}, e3: {} })
  const [loans,     setLoans]     = useState([])
  const [taseLoans, setTaseLoans] = useState([])
  const [tab,       setTab]       = useState('t2')
  const [loading,   setLoading]   = useState(true)
  const [history,   setHistory]   = useState([]) // undo stack: array of manual snapshots

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  async function loadAll() {
    const [{ data: months }, { data: params }, { data: lns }, { data: tase }] = await Promise.all([
      supabaseAdmin
        .from('tulos_kuukausiraportti')
        .select('period, liikevaihto, muut_tuotot, materiaalit_palvelut, henkilostokulut, muut_kulut, poistot, tilikauden_voitto')
        .order('period'),
      supabaseAdmin.from('ennuste_params').select('*'),
      supabaseAdmin.from('ennuste_lainat').select('*').order('sort_order').order('created_at'),
      supabaseAdmin
        .from('tase_snapshot')
        .select('account_code, account_name, sub_section, loppusaldo')
        .in('sub_section', ['vieras_pit', 'vieras_lyh'])
        .not('account_code', 'is', null)
        .order('sub_section')
        .order('account_code'),
    ])
    setMonthData(months || [])

    const m = { e1: {}, e2: {}, e3: {} }
    for (const row of (params || [])) {
      if (!m[row.period]) continue
      for (const key of ALL_KEYS) {
        if (row[key] != null) m[row.period][key] = row[key]
      }
    }
    setManual(m)
    setLoans(lns || [])

    // Suodata vain rahoituslainat (tilit 262x = pit. lainat, 282x = lyhennyserät)
    const loanAccounts = (tase || []).filter(r =>
      r.loppusaldo !== 0 &&
      (r.account_code.startsWith('262') || r.account_code.startsWith('282'))
    )
    setTaseLoans(loanAccounts)

    setLoading(false)
  }

  const { actuals, auto, growth } = deriveAuto(monthData, taseLoans)
  const actualsCalc = calcValues(actuals)

  function resolve(p) {
    const inp = {}
    for (const k of INPUT_KEYS) inp[k] = manual[p]?.[k] ?? auto[p]?.[k] ?? 0
    return calcValues(inp)
  }

  const r = { e1: resolve('e1'), e2: resolve('e2'), e3: resolve('e3') }

  async function saveCell(p, key, value) {
    setHistory(h => [...h.slice(-29), manual]) // max 30 steps

    const nm = { ...manual, [p]: { ...manual[p] } }
    if (value === null) delete nm[p][key]; else nm[p][key] = value
    setManual(nm)

    const row = { period: p }
    for (const k of ALL_KEYS) row[k] = nm[p][k] ?? null
    await supabaseAdmin.from('ennuste_params').upsert(row, { onConflict: 'period' })
  }

  async function handleUndo() {
    setHistory(h => {
      if (!h.length) return h
      const prev = h[h.length - 1]
      setManual(prev)
      // Persist all three periods to DB
      Promise.all(
        PERIODS.map(p => {
          const row = { period: p }
          for (const k of ALL_KEYS) row[k] = prev[p]?.[k] ?? null
          return supabaseAdmin.from('ennuste_params').upsert(row, { onConflict: 'period' })
        })
      )
      return h.slice(0, -1)
    })
  }

  const chartData = [
    { name: 'Toteutunut', lv: actualsCalc.liikevaihto, kate: actualsCalc.kayttokate, tulos: actualsCalc.kokonaistulos },
    { name: 'Ennuste 1',  lv: r.e1.liikevaihto, kate: r.e1.kayttokate, tulos: r.e1.kokonaistulos },
    { name: 'Ennuste 2',  lv: r.e2.liikevaihto, kate: r.e2.kayttokate, tulos: r.e2.kokonaistulos },
    { name: 'Ennuste 3',  lv: r.e3.liikevaihto, kate: r.e3.kayttokate, tulos: r.e3.kokonaistulos },
  ]

  // ─── T2 render helpers ──────────────────────────────────────────────────────

  function T2CalcRow({ row }) {
    const bg  = CALC_BG[(row.level || 1) - 1]
    const tdS = { padding: '8px 12px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }
    return (
      <tr style={{ background: bg }}>
        <td style={{ ...tdS, fontWeight: 800, letterSpacing: '.02em' }}>{row.label}</td>
        <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: actualsCalc[row.id] < 0 ? 'var(--red)' : 'var(--violet)' }}>
          {fmt(actualsCalc[row.id])}
        </td>
        <td style={{ ...tdS, textAlign: 'right', fontSize: '.72rem', color: 'var(--text3)' }}>
          {pct(actualsCalc[row.id], actualsCalc.tuotot_yht)}
        </td>
        {PERIODS.map(p => (
          <Fragment key={p}>
            <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: r[p][row.id] < 0 ? 'var(--red)' : 'var(--violet)' }}>
              {fmt(r[p][row.id])}
            </td>
            <td style={{ ...tdS, textAlign: 'right', fontSize: '.72rem', color: 'var(--text3)' }}>
              {pct(r[p][row.id], r[p].tuotot_yht)}
            </td>
          </Fragment>
        ))}
      </tr>
    )
  }

  function T2InputRow({ row }) {
    const tdS = { padding: '6px 12px', borderBottom: '1px solid var(--border)', fontSize: '.8rem' }
    const actVal = row.cost ? Math.abs(actualsCalc[row.id] || 0) : actualsCalc[row.id]
    return (
      <tr style={{ background: row.id === 'liikevaihto' ? 'color-mix(in srgb, var(--green) 4%, var(--bg1))' : undefined }}>
        <td style={{ ...tdS, color: row.cost ? 'var(--red)' : 'var(--text1)' }}>
          {row.cost && <span style={{ color: 'var(--red)', marginRight: 4, fontWeight: 700 }}>–</span>}
          {row.label}
        </td>
        <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace', color: row.cost ? 'var(--red)' : 'var(--text2)' }}>
          {fmt(actVal)}
        </td>
        <td style={{ ...tdS, textAlign: 'right', fontSize: '.72rem', color: 'var(--text3)' }}>
          {pct(actualsCalc[row.id], actualsCalc.tuotot_yht)}
        </td>
        {PERIODS.map(p => (
          <Fragment key={p}>
            <td style={{ ...tdS, padding: '3px 6px' }}>
              <CellInput
                autoVal={auto[p]?.[row.id] ?? 0}
                manualVal={manual[p]?.[row.id] ?? null}
                onSave={v => saveCell(p, row.id, v)}
              />
            </td>
            <td style={{ ...tdS, textAlign: 'right', fontSize: '.72rem', color: 'var(--text3)' }}>
              {pct(r[p][row.id], r[p].tuotot_yht)}
            </td>
          </Fragment>
        ))}
      </tr>
    )
  }

  // ─── render ─────────────────────────────────────────────────────────────────

  if (loading) return <div><KirjanpitoNav /><div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text3)' }}>Ladataan...</div></div>

  return (
    <div>
      <KirjanpitoNav />

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Ennuste</h1>
          <p className="page-subtitle">Tulossuunnitelma · Rahoitussuunnitelma · Lainat</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Kumoa viimeisin muutos (⌘Z)"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8, fontSize: '.78rem', fontWeight: 600,
              border: '1px solid var(--border)', cursor: history.length ? 'pointer' : 'not-allowed',
              background: history.length ? 'var(--bg)' : 'var(--bg2)',
              color: history.length ? 'var(--text2)' : 'var(--text3)',
              transition: 'background .15s',
            }}
          >
            ↩ Kumoa{history.length > 0 ? ` (${history.length})` : ''}
          </button>
          {growth !== 0 && (
            <div style={{
              padding: '6px 14px', borderRadius: 20, fontSize: '.78rem', fontWeight: 700,
              background: growth > 0 ? 'color-mix(in srgb, var(--green) 12%, var(--bg1))' : 'color-mix(in srgb, var(--red) 12%, var(--bg1))',
              color: growth > 0 ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${growth > 0 ? 'var(--green)' : 'var(--red)'}`,
            }}>
              Arvioitu kasvu {growth > 0 ? '+' : ''}{growth} %/v (historiadatasta)
            </div>
          )}
        </div>
      </div>

      {/* Yhteenveto-kaavio */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', marginBottom: '.75rem' }}>
          Liikevaihto ja tulos — toteutunut + ennusteet
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={4} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: '.75rem', fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: '.72rem', fill: 'var(--text3)' }} axisLine={false} tickLine={false}
              tickFormatter={v => (Math.abs(v) >= 1000 ? Math.round(v / 1000) + 'k' : v) + ' €'} />
            <Tooltip
              formatter={(v, n) => [fmt(v), n]}
              labelStyle={{ color: 'var(--text)', fontWeight: 700 }}
              contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '.78rem' }}
            />
            <Legend wrapperStyle={{ fontSize: '.75rem' }} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Bar dataKey="lv"    name="Liikevaihto"   fill="#16A34A" radius={[3,3,0,0]} fillOpacity={0.85} />
            <Bar dataKey="kate"  name="Käyttökate"    fill="#7C3AED" radius={[3,3,0,0]} fillOpacity={0.85} />
            <Bar dataKey="tulos" name="Kokonaistulos" fill="#0891B2" radius={[3,3,0,0]} fillOpacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Välilehdet */}
      <div className="sub-tabs" style={{ marginBottom: '1rem' }}>
        {[['t2', 'T2 Tulossuunnitelma'], ['t4', 'T4 Rahoitussuunnitelma'], ['t7', 'T7 Lainat']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`sub-tab${tab === k ? ' active' : ''}`}>{l}</button>
        ))}
      </div>

      {/* T2 */}
      {tab === 't2' && (
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem', minWidth: 860 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, minWidth: 280 }}>Erä</th>
                <th colSpan={2} style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 700, color: 'var(--text3)', borderRight: '1px solid var(--border)' }}>Toteutunut</th>
                {PERIODS.map((p, i) => (
                  <th key={p} colSpan={2} style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 700, borderRight: i < 2 ? '1px solid var(--border)' : undefined, minWidth: 230 }}>
                    {P_LABELS[p]}
                  </th>
                ))}
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th />
                <th style={{ textAlign: 'right', padding: '4px 12px', fontSize: '.72rem', color: 'var(--text3)', fontWeight: 600 }}>€</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '.72rem', color: 'var(--text3)', fontWeight: 600, borderRight: '1px solid var(--border)' }}>%</th>
                {PERIODS.map((p, i) => (
                  <Fragment key={p}>
                    <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '.72rem', color: 'var(--text3)', fontWeight: 600 }}>€ / syötä</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '.72rem', color: 'var(--text3)', fontWeight: 600, borderRight: i < 2 ? '1px solid var(--border)' : undefined }}>%</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {T2_ROWS.map(row =>
                row.calc
                  ? <T2CalcRow key={row.id} row={row} />
                  : <T2InputRow key={row.id} row={row} />
              )}
            </tbody>
          </table>
          <div style={{ padding: '.6rem 1rem', fontSize: '.7rem', color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
            <strong>A</strong> = automaattinen arvio historiasta. Tyhjennä kenttä palauttaaksesi automaattiseksi. Kuluerät syötetään positiivisina lukuina (vähennetään automaattisesti).
          </div>
        </div>
      )}

      {tab === 't4' && <T4Tab r={r} manual={manual} auto={auto} saveCell={saveCell} />}
      {tab === 't7' && <T7Tab loans={loans} setLoans={setLoans} taseLoans={taseLoans} />}
    </div>
  )
}
