import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import KirjanpitoNav from '../../components/KirjanpitoNav'

function fmt(v, decimals = 0) {
  if (v == null) return '—'
  return Number(v).toLocaleString('fi-FI', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' €'
}

// Tilikausi 1.5 – 30.4: huhtikuu on aina kuluvan kalenterivuoden huhtikuu
function getFiscalYear() {
  const now = new Date()
  const fyYear = now.getFullYear()
  return { fyStart: `${fyYear - 1}-05`, fyEnd: `${fyYear}-04`, fyLabel: `1.5.${fyYear - 1}–30.4.${fyYear}` }
}

export default function Kirjanpito() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { fyStart, fyEnd } = getFiscalYear()

    const [tulosRes, taseRes, kassaRes] = await Promise.all([
      supabase.from('tulos_kuukausiraportti').select('*')
        .gte('period', fyStart).lte('period', fyEnd)
        .order('period', { ascending: false }),
      supabase.from('tase_snapshot').select('sub_section, loppusaldo'),
      supabase.from('kassavirta_entries').select('amount, entry_type').order('entry_date', { ascending: false }).limit(200),
    ])

    const tulosRows = tulosRes.data || []
    const latest = tulosRows[0] || null                                          // viimeisin kuukausi
    const fyVoitto = tulosRows.reduce((s, r) => s + (r.tilikauden_voitto || 0), 0) // koko tilikausi

    const taseRows = taseRes.data || []
    const kassaEntries = kassaRes.data || []

    const omaPaaoma = taseRows.filter(r => r.sub_section === 'oma_paaoma').reduce((s, r) => s + (r.loppusaldo || 0), 0)
    const rahat = taseRows.filter(r => r.sub_section === 'rahat').reduce((s, r) => s + (r.loppusaldo || 0), 0)
    const kassaTulot = kassaEntries.filter(r => r.entry_type === 'tulo').reduce((s, r) => s + (r.amount || 0), 0)
    const kassaMenot = kassaEntries.filter(r => r.entry_type === 'meno').reduce((s, r) => s + (r.amount || 0), 0)

    setData({ latest, fyVoitto, omaPaaoma, rahat, kassaTulot, kassaMenot })
    setLoading(false)
  }

  const { fyLabel } = getFiscalYear()
  const t = data?.latest
  const periodLabel = t?.period
    ? new Date(t.period + '-01').toLocaleDateString('fi-FI', { month: 'long', year: 'numeric' })
    : null

  return (
    <div>
      <KirjanpitoNav />

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Kirjanpito</h1>
          <p className="page-subtitle">Tilikausi {fyLabel}</p>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)', padding: '3rem', textAlign: 'center' }}>Ladataan...</div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: '2rem' }}>
            <div className="stat-card">
              <div className="stat-label">Liikevaihto {periodLabel ? `(${periodLabel})` : ''}</div>
              <div className="stat-value gold">{fmt(t?.liikevaihto)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Liikevoitto {periodLabel ? `(${periodLabel})` : ''}</div>
              <div className="stat-value" style={{ color: (t?.liikevoitto || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmt(t?.liikevoitto)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Tilikauden voitto ({fyLabel})</div>
              <div className="stat-value" style={{ color: (data?.fyVoitto || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmt(data?.fyVoitto)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Oma pääoma</div>
              <div className="stat-value" style={{ color: 'var(--violet)' }}>{fmt(data?.omaPaaoma)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Rahat &amp; pankkisaamiset</div>
              <div className="stat-value">{fmt(data?.rahat)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Kassavirta (saldo)</div>
              <div className="stat-value" style={{ color: ((data?.kassaTulot || 0) - (data?.kassaMenot || 0)) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmt((data?.kassaTulot || 0) - (data?.kassaMenot || 0))}
              </div>
            </div>
          </div>

          <div>
            <a href="/finance/kirjanpito/tuonti" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s', display: 'inline-block', minWidth: 200 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--violet)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--violet-subtle)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = '' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '.35rem' }}>Tuo CSV</div>
                <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>Tuo Netvisor-raportit</div>
              </div>
            </a>
          </div>
        </>
      )}
    </div>
  )
}
