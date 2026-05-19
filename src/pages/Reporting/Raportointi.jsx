import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const CARDS = [
  { label: 'Terapiamyynti', to: '/finance/raportointi/terapiamyynti', table: 'terapiamyynti', color: 'var(--violet)' },
  { label: 'Valmennusmyynti', to: '/finance/raportointi/valmennusmyynti', table: 'valmennusmyynti', color: 'var(--blue)' },
  { label: 'Jäsenmyynti', to: '/finance/raportointi/jasenmyynti', table: 'jasenmyynti', color: 'var(--orange)' },
  { label: 'Lahjakortit', to: '/finance/raportointi/lahjakortit', table: 'lahjakortit', color: 'var(--green)' },
]

export default function Raportointi() {
  const [totals, setTotals] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTotals()
  }, [])

  async function fetchTotals() {
    const monthStart = new Date().toISOString().slice(0, 7) + '-01'
    const results = await Promise.all(
      CARDS.map(c => supabase.from(c.table).select('price, value').gte('created_at', monthStart))
    )
    const t = {}
    CARDS.forEach((c, i) => {
      const data = results[i].data || []
      t[c.table] = data.reduce((s, r) => s + (r.price || r.value || 0), 0)
    })
    setTotals(t)
    setLoading(false)
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Raportointi</h1>
          <p className="page-subtitle">Myynnin raportointi ja analytiikka</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {CARDS.map(c => (
          <Link key={c.to} to={c.to} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', borderTop: `3px solid ${c.color}`, transition: 'box-shadow .15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', marginBottom: '.5rem' }}>{c.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '2rem', color: c.color, lineHeight: 1 }}>
                {loading ? '...' : totals[c.table]?.toFixed(2)} €
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.4rem' }}>Kuluva kuukausi</div>
              <div style={{ marginTop: '1rem', fontSize: '.78rem', color: c.color, fontWeight: 600 }}>Avaa raportti →</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
