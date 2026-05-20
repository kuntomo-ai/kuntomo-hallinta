import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import KirjanpitoNav from '../../components/KirjanpitoNav'

function fmt(v, decimals = 0) {
  if (v == null) return '—'
  return Number(v).toLocaleString('fi-FI', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' €'
}

export default function Kirjanpito() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [tulosRes, taseRes, kassaRes] = await Promise.all([
      supabase.from('tulos_kuukausiraportti').select('*').order('period', { ascending: false }).limit(1),
      supabase.from('tase_snapshot').select('sub_section, loppusaldo'),
      supabase.from('kassavirta_entries').select('amount, entry_type').order('entry_date', { ascending: false }).limit(200),
    ])

    const tulos = tulosRes.data?.[0] || null
    const taseRows = taseRes.data || []
    const kassaEntries = kassaRes.data || []

    const omaPaaoma = taseRows.filter(r => r.sub_section === 'oma_paaoma').reduce((s, r) => s + (r.loppusaldo || 0), 0)
    const vastaavaa = taseRows.reduce((s, r) => {
      const sideRows = taseRows.filter(x => ['aineettomat','aineelliset','sijoitukset','vaihto','saamiset','rahat'].includes(x.sub_section))
      return s
    }, 0)
    const rahat = taseRows.filter(r => r.sub_section === 'rahat').reduce((s, r) => s + (r.loppusaldo || 0), 0)

    const kassaTulot = kassaEntries.filter(r => r.entry_type === 'tulo').reduce((s, r) => s + (r.amount || 0), 0)
    const kassaMenot = kassaEntries.filter(r => r.entry_type === 'meno').reduce((s, r) => s + (r.amount || 0), 0)

    setData({ tulos, omaPaaoma, rahat, kassaTulot, kassaMenot })
    setLoading(false)
  }

  const t = data?.tulos

  const periodLabel = t?.period
    ? new Date(t.period + '-01').toLocaleDateString('fi-FI', { month: 'long', year: 'numeric' })
    : null

  return (
    <div>
      <KirjanpitoNav />

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Kirjanpito</h1>
          <p className="page-subtitle">
            {periodLabel ? `Viimeisin jakso: ${periodLabel}` : 'Talouden hallinta ja seuranta'}
          </p>
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
              <div className="stat-label">Tilikauden voitto</div>
              <div className="stat-value" style={{ color: (t?.tilikauden_voitto || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmt(t?.tilikauden_voitto)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Oma pääoma</div>
              <div className="stat-value" style={{ color: 'var(--violet)' }}>
                {fmt(data?.omaPaaoma)}
              </div>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Tase', desc: 'Vastaavaa ja vastattavaa', to: '/finance/kirjanpito/tase' },
              { label: 'Tuloslaskelma', desc: 'Tuotot ja kulut', to: '/finance/kirjanpito/tulos' },
              { label: 'Kassavirta', desc: 'Tulot ja menot', to: '/finance/kirjanpito/kassavirta' },
              { label: 'Tuo CSV', desc: 'Tuo Netvisor-raportit', to: '/finance/kirjanpito/tuonti' },
            ].map(c => (
              <a key={c.to} href={c.to} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--violet)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--violet-subtle)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = '' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '.35rem' }}>{c.label}</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>{c.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
