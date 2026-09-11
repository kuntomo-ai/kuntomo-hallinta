import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

const MONTH_ABBR = ['Tam','Hel','Maa','Huh','Tou','Kes','Hei','Elo','Syy','Lok','Mar','Jou']
const RATE = 0.015

function fmt(v) {
  return v.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function Provisio() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [year])

  async function fetchData() {
    setLoading(true)
    let all = []
    let idx = 0
    while (true) {
      const { data } = await supabase
        .from('terapiamyynti')
        .select('entry_date, visit_date, created_at, employee_name, price')
        .gte('entry_date', `${year}-01-01`)
        .lte('entry_date', `${year}-12-31`)
        .range(idx, idx + 999)
      if (!data?.length) break
      all = all.concat(data)
      if (data.length < 1000) break
      idx += 1000
    }
    setRows(all)
    setLoading(false)
  }

  const pivot = useMemo(() => {
    const empMap = {}
    rows.forEach(r => {
      const d = r.entry_date || r.visit_date || r.created_at?.slice(0, 10)
      if (!d) return
      const month = parseInt(d.slice(5, 7)) - 1
      const emp = r.employee_name || '(ei myyjää)'
      if (!empMap[emp]) empMap[emp] = {}
      empMap[emp][month] = (empMap[emp][month] || 0) + (r.price || 0)
    })
    const emps = Object.keys(empMap).sort()
    const monthTotals = Array.from({ length: 12 }, (_, m) =>
      emps.reduce((s, e) => s + (empMap[e][m] || 0), 0)
    )
    const grandTotal = monthTotals.reduce((s, v) => s + v, 0)
    return { empMap, emps, monthTotals, grandTotal }
  }, [rows])

  const years = [currentYear - 1, currentYear]

  const cellStyle = (v, bg) => ({
    textAlign: 'right',
    padding: '7px 8px',
    color: v > 0 ? 'var(--text1)' : 'var(--text3)',
    background: bg,
  })

  return (
    <div>
      {/* Vuosivalitsin */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem' }}>
        {years.map(y => (
          <button key={y} className={`sub-tab${year === y ? ' active' : ''}`} onClick={() => setYear(y)}>{y}</button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text3)' }}>Ladataan...</p>
      ) : pivot.emps.length === 0 ? (
        <p style={{ color: 'var(--text3)' }}>Ei terapiamyyntikirjauksia vuodelle {year}.</p>
      ) : (
        <>
          {/* Yhteenvetokortit */}
          <div className="stats-grid" style={{ marginBottom: '1.75rem' }}>
            <div className="stat-card">
              <div className="stat-label">Bruttomyynti {year}</div>
              <div className="stat-value">{fmt(pivot.grandTotal)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Provisio yhteensä (1,5 %)</div>
              <div className="stat-value gold">{fmt(pivot.grandTotal * RATE)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Myyjiä</div>
              <div className="stat-value">{pivot.emps.length}</div>
            </div>
          </div>

          {/* Pivot-taulukko */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '.8rem', width: '100%', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 14px', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--bg1)', zIndex: 2, minWidth: 140 }}>Myyjä</th>
                  {MONTH_ABBR.map((m, i) => (
                    <th key={i} style={{ textAlign: 'right', padding: '8px 8px', color: 'var(--text3)', fontWeight: 700, whiteSpace: 'nowrap', minWidth: 80 }}>{m}</th>
                  ))}
                  <th style={{ textAlign: 'right', padding: '8px 12px', whiteSpace: 'nowrap', minWidth: 105 }}>Brutto yht.</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: '#D97706', fontWeight: 800, whiteSpace: 'nowrap', minWidth: 105 }}>Provisio 1,5 %</th>
                </tr>
              </thead>
              <tbody>
                {pivot.emps.map((emp, ei) => {
                  const bg = ei % 2 === 0 ? 'var(--bg1)' : 'var(--bg2)'
                  const empTotal = Object.values(pivot.empMap[emp]).reduce((s, v) => s + v, 0)
                  return (
                    <tr key={emp} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 14px', fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: bg, zIndex: 1 }}>{emp}</td>
                      {Array.from({ length: 12 }, (_, m) => {
                        const val = pivot.empMap[emp][m] || 0
                        return (
                          <td key={m} style={cellStyle(val, bg)}>
                            {val > 0 ? val.toFixed(2) + ' €' : '—'}
                          </td>
                        )
                      })}
                      <td style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 700, background: bg }}>{fmt(empTotal)}</td>
                      <td style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 800, color: '#D97706', background: bg }}>{fmt(empTotal * RATE)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'color-mix(in srgb, var(--violet) 6%, var(--bg1))' }}>
                  <td style={{ padding: '9px 14px', fontWeight: 800, textTransform: 'uppercase', fontSize: '.73rem', letterSpacing: '.05em', position: 'sticky', left: 0, background: 'color-mix(in srgb, var(--violet) 6%, var(--bg1))', zIndex: 1 }}>Yhteensä</td>
                  {pivot.monthTotals.map((v, m) => (
                    <td key={m} style={{ textAlign: 'right', padding: '9px 8px', fontWeight: 700, color: v > 0 ? 'var(--violet)' : 'var(--text3)' }}>
                      {v > 0 ? v.toFixed(2) + ' €' : '—'}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', padding: '9px 12px', fontWeight: 900, color: 'var(--violet)', fontSize: '.88rem' }}>
                    {fmt(pivot.grandTotal)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '9px 12px', fontWeight: 900, color: '#D97706', fontSize: '.95rem' }}>
                    {fmt(pivot.grandTotal * RATE)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Yhteenveto per myyjä (laskutusta varten) */}
          <div className="card" style={{ marginTop: '1.75rem', padding: '1.25rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', marginBottom: '1rem' }}>
              Laskutusyhteenveto {year}
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.83rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text3)', fontWeight: 700 }}>Myyjä</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--text3)', fontWeight: 700 }}>Bruttomyynti</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--text3)', fontWeight: 700 }}>Provisio 1,5 %</th>
                </tr>
              </thead>
              <tbody>
                {pivot.emps.map((emp, ei) => {
                  const total = Object.values(pivot.empMap[emp]).reduce((s, v) => s + v, 0)
                  return (
                    <tr key={emp} style={{ borderBottom: '1px solid var(--border)', background: ei % 2 === 0 ? '' : 'var(--bg2)' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 600 }}>{emp}</td>
                      <td style={{ textAlign: 'right', padding: '7px 10px' }}>{fmt(total)}</td>
                      <td style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 800, color: '#D97706' }}>{fmt(total * RATE)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 800 }}>Yhteensä</td>
                  <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 800, color: 'var(--violet)' }}>{fmt(pivot.grandTotal)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 900, color: '#D97706', fontSize: '.9rem' }}>{fmt(pivot.grandTotal * RATE)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
