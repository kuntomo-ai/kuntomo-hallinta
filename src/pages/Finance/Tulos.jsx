import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import KirjanpitoNav from '../../components/KirjanpitoNav'

const MONTHS_FI = ['Tammi', 'Helmi', 'Maalis', 'Huhti', 'Touko', 'Kesä',
                   'Heinä', 'Elo', 'Syys', 'Loka', 'Marras', 'Joulu']

// 'YYYY-MM' → esim. 'Kesä 26'
function monthLabel(period) {
  if (!period) return '—'
  const [y, m] = period.split('-').map(Number)
  return `${MONTHS_FI[m - 1]} ${String(y).slice(2)}`
}

// Tilikausi alkaa 1.5. — palauta jaksoon kuuluvan tilikauden rajat.
function fiscalYear(period) {
  const [y, m] = period.split('-').map(Number)
  const startYear = m >= 5 ? y : y - 1
  return { startYear, start: `${startYear}-05`, end: `${startYear + 1}-04` }
}

function fmt(v, decimals = 0) {
  if (v == null) return '—'
  const n = Number(v)
  return n.toLocaleString('fi-FI', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' €'
}

function colorVal(v) {
  if (v == null) return 'var(--text2)'
  return Number(v) >= 0 ? 'var(--green)' : 'var(--red)'
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: '.8rem' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {Number(p.value).toLocaleString('fi-FI', { maximumFractionDigits: 0 })} €
        </div>
      ))}
    </div>
  )
}

export default function Tulos() {
  const [rows, setRows] = useState([])
  const [fy, setFy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('tulos_kuukausiraportti')
      .select('*')
      .order('period')
    const all = data || []
    if (all.length) {
      // Näytä uusin tilikausi (touko–huhti) — jaksot ovat nousevassa järjestyksessä.
      const fyBounds = fiscalYear(all[all.length - 1].period)
      setFy(fyBounds)
      setRows(all.filter(r => r.period >= fyBounds.start && r.period <= fyBounds.end))
    } else {
      setFy(null)
      setRows([])
    }
    setLoading(false)
  }

  const chartData = rows.map(r => ({
    period: monthLabel(r.period),
    'Liikevaihto': Math.round(r.liikevaihto || 0),
    'Muut tuotot': Math.round(r.muut_tuotot || 0),
    'Materiaalit & palvelut': Math.round(Math.abs(r.materiaalit_palvelut || 0)),
    'Henkilöstökulut': Math.round(Math.abs(r.henkilostokulut || 0)),
    'Muut kulut': Math.round(Math.abs(r.muut_kulut || 0)),
    'Poistot': Math.round(Math.abs(r.poistot || 0)),
    'Liikevoitto': Math.round(r.liikevoitto || 0),
    'Tilikauden voitto': Math.round(r.tilikauden_voitto || 0),
  }))

  const totalLiikevaihto = rows.reduce((s, r) => s + (r.liikevaihto || 0), 0)
  const totalVoitto = rows.reduce((s, r) => s + (r.tilikauden_voitto || 0), 0)
  const avgLiikevaihto = rows.length ? totalLiikevaihto / rows.length : 0
  const bestMonth = rows.reduce((best, r) => (!best || r.liikevaihto > best.liikevaihto) ? r : best, null)

  const sel = selected ? rows.find(r => r.period === selected) : null

  if (loading) return (
    <div><KirjanpitoNav />
      <div style={{ color: 'var(--text3)', padding: '3rem', textAlign: 'center' }}>Ladataan...</div>
    </div>
  )

  if (!rows.length) return (
    <div><KirjanpitoNav />
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Tuloslaskelma</h1>
          <p className="page-subtitle">Tuotot ja kulut kuukausittain</p>
        </div>
      </div>
      <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', padding: '3rem' }}>
        Ei dataa. Aja <code>tulos_kuukausiraportti.sql</code> Supabase SQL Editorissa.
      </div>
    </div>
  )

  return (
    <div>
      <KirjanpitoNav />

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Tuloslaskelma</h1>
          <p className="page-subtitle">
            {fy ? `Tilikausi 1.5.${fy.startYear} – 30.4.${fy.startYear + 1}` : ''} · {rows.length} kuukautta
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-label">Liikevaihto yhteensä</div>
          <div className="stat-value gold">{fmt(totalLiikevaihto)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tilikauden tulos (tulos ennen veroja)</div>
          <div className="stat-value" style={{ color: colorVal(totalVoitto) }}>{fmt(totalVoitto)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Liikevaihto / kk (ka.)</div>
          <div className="stat-value">{fmt(avgLiikevaihto)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Paras kuukausi</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>
            {bestMonth ? monthLabel(bestMonth.period) : '—'}
          </div>
          <div style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: '.2rem' }}>
            {bestMonth ? `LV: ${fmt(bestMonth.liikevaihto)}` : ''}
          </div>
          <div style={{ fontSize: '.75rem', color: colorVal(bestMonth?.tilikauden_voitto), fontWeight: 600 }}>
            {bestMonth ? `Tulos: ${fmt(bestMonth.tilikauden_voitto)}` : ''}
          </div>
        </div>
      </div>

      {/* Liikevaihto bar chart */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1.25rem' }}>
          Liikevaihto kuukausittain
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--text3)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={v => (v/1000).toFixed(0)+'k'} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="Liikevaihto" fill="var(--violet)" radius={[4,4,0,0]} />
            <Bar dataKey="Muut tuotot" fill="var(--violet-subtle)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Liikevoitto & tulos line chart */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1.25rem' }}>
          Tulos kuukausittain
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--text3)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={v => (v/1000).toFixed(0)+'k'} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="var(--border)" strokeWidth={2} />
            <Line type="monotone" dataKey="Liikevoitto" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="Tilikauden voitto" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Cost breakdown stacked bar */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '1.25rem' }}>
          Kustannusrakenne kuukausittain
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--text3)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={v => (v/1000).toFixed(0)+'k'} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Materiaalit & palvelut" stackId="a" fill="#f59e0b" />
            <Bar dataKey="Henkilöstökulut" stackId="a" fill="#ef4444" />
            <Bar dataKey="Muut kulut" stackId="a" fill="#6366f1" />
            <Bar dataKey="Poistot" stackId="a" fill="#94a3b8" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly table */}
      <div className="card" style={{ marginBottom: '2rem', padding: 0 }}>
        <div style={{ padding: '1rem 1.25rem', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', borderBottom: '1px solid var(--border)' }}>
          Kuukausittainen erittely
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Kuukausi</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Liikevaihto</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Mat. & palv.</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Hlöstökulut</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Muut kulut</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Poistot</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Liikevoitto</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Tilikauden voitto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.period}
                  onClick={() => setSelected(selected === r.period ? null : r.period)}
                  style={{
                    cursor: 'pointer',
                    background: selected === r.period ? 'var(--violet-subtle)' : undefined,
                    borderBottom: '1px solid var(--border)',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (selected !== r.period) e.currentTarget.style.background = 'var(--bg2)' }}
                  onMouseLeave={e => { if (selected !== r.period) e.currentTarget.style.background = '' }}
                >
                  <td style={{ padding: '9px 12px', fontWeight: 700 }}>{monthLabel(r.period)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(r.liikevaihto)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--red)' }}>{fmt(r.materiaalit_palvelut)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--red)' }}>{fmt(r.henkilostokulut)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--red)' }}>{fmt(r.muut_kulut)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text3)' }}>{fmt(r.poistot)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: colorVal(r.liikevoitto) }}>{fmt(r.liikevoitto)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: colorVal(r.tilikauden_voitto) }}>{fmt(r.tilikauden_voitto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg2)', borderTop: '2px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 800 }}>Yhteensä</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--gold)' }}>{fmt(rows.reduce((s,r)=>s+(r.liikevaihto||0),0))}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>{fmt(rows.reduce((s,r)=>s+(r.materiaalit_palvelut||0),0))}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>{fmt(rows.reduce((s,r)=>s+(r.henkilostokulut||0),0))}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>{fmt(rows.reduce((s,r)=>s+(r.muut_kulut||0),0))}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text3)', fontWeight: 700 }}>{fmt(rows.reduce((s,r)=>s+(r.poistot||0),0))}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: colorVal(rows.reduce((s,r)=>s+(r.liikevoitto||0),0)) }}>{fmt(rows.reduce((s,r)=>s+(r.liikevoitto||0),0))}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: colorVal(totalVoitto) }}>{fmt(totalVoitto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Selected month detail */}
      {sel && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', marginBottom: '1.25rem' }}>
            {monthLabel(sel.period)} – Erittely
          </div>
          <div className="grid-cols-2" style={{ gap: '1.5rem' }}>
            <div>
              {[
                { label: 'Liikevaihto', val: sel.liikevaihto, bold: true },
                { label: 'Liiketoiminnan muut tuotot', val: sel.muut_tuotot },
                { label: 'Materiaalit ja palvelut', val: sel.materiaalit_palvelut, cost: true },
                { label: 'Henkilöstökulut', val: sel.henkilostokulut, cost: true },
                { label: 'Liiketoiminnan muut kulut', val: sel.muut_kulut, cost: true },
                { label: 'Poistot', val: sel.poistot, cost: true },
              ].map(({ label, val, bold, cost }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '.84rem' }}>
                  <span style={{ color: 'var(--text2)', fontWeight: bold ? 700 : 400 }}>{label}</span>
                  <span style={{ fontWeight: bold ? 800 : 600, color: cost ? 'var(--red)' : bold ? 'var(--text1)' : 'var(--green)' }}>{fmt(val, 2)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '.92rem' }}>
                <span style={{ fontWeight: 800 }}>Liikevoitto</span>
                <span style={{ fontWeight: 900, color: colorVal(sel.liikevoitto) }}>{fmt(sel.liikevoitto, 2)}</span>
              </div>
            </div>
            <div>
              {[
                { label: 'Rahoitustuotot ja -kulut', val: sel.rahoitustuotot_kulut },
                { label: 'Tulos ennen veroja', val: sel.tulos_ennen_veroja, bold: true },
                { label: 'Tuloverot', val: sel.tuloverot },
              ].map(({ label, val, bold }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '.84rem' }}>
                  <span style={{ color: 'var(--text2)', fontWeight: bold ? 700 : 400 }}>{label}</span>
                  <span style={{ fontWeight: bold ? 800 : 600, color: colorVal(val) }}>{fmt(val, 2)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '1rem', marginTop: '0.5rem' }}>
                <span style={{ fontWeight: 800 }}>Tilikauden voitto</span>
                <span style={{ fontWeight: 900, fontSize: '1.2rem', color: colorVal(sel.tilikauden_voitto) }}>{fmt(sel.tilikauden_voitto, 2)}</span>
              </div>

              {/* Mini cost pie visualization */}
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '.75rem', color: 'var(--text3)', marginBottom: '.5rem', fontWeight: 600 }}>KUSTANNUSOSUUDET</div>
                {[
                  { label: 'Mat. & palv.', val: Math.abs(sel.materiaalit_palvelut||0), color: '#f59e0b' },
                  { label: 'Henkilöstö', val: Math.abs(sel.henkilostokulut||0), color: '#ef4444' },
                  { label: 'Muut kulut', val: Math.abs(sel.muut_kulut||0), color: '#6366f1' },
                  { label: 'Poistot', val: Math.abs(sel.poistot||0), color: '#94a3b8' },
                ].map(({ label, val, color }) => {
                  const totalCosts = Math.abs(sel.materiaalit_palvelut||0)+Math.abs(sel.henkilostokulut||0)+Math.abs(sel.muut_kulut||0)+Math.abs(sel.poistot||0)
                  const pct = totalCosts > 0 ? val / totalCosts * 100 : 0
                  return (
                    <div key={label} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', marginBottom: 2 }}>
                        <span style={{ color: 'var(--text2)' }}>{label}</span>
                        <span style={{ color: 'var(--text3)' }}>{pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .4s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
