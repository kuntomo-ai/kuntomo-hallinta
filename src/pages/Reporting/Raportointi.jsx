import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const SALES_CARDS = [
  { label: 'Terapiamyynti', to: '/finance/raportointi/terapiamyynti', table: 'terapiamyynti', color: 'var(--violet)' },
  { label: 'Valmennusmyynti', to: '/finance/raportointi/valmennusmyynti', table: 'valmennusmyynti', color: 'var(--blue)' },
  { label: 'Jäsenmyynti', to: '/finance/raportointi/jasenmyynti', table: 'jasenmyynti', color: 'var(--orange)' },
  { label: 'Lahjakortit', to: '/finance/raportointi/lahjakortit', table: 'lahjakortit', color: 'var(--green)' },
]

function ReportCard({ to, color, title, subtitle, value, unit, loading }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ cursor: 'pointer', borderTop: `3px solid ${color}`, transition: 'box-shadow .15s', height: '100%' }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', marginBottom: '.5rem' }}>{title}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '2rem', color, lineHeight: 1 }}>
          {loading ? '...' : value}
        </div>
        <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.4rem' }}>{subtitle}</div>
        <div style={{ marginTop: '1rem', fontSize: '.78rem', color, fontWeight: 600 }}>Avaa raportti →</div>
      </div>
    </Link>
  )
}

export default function Raportointi() {
  const { isAdmin, isHallitus, role } = useAuth()
  const showMembership = isAdmin || isHallitus || role === 'respa'

  const [totals, setTotals] = useState({})
  const [memberTotal, setMemberTotal] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchTotals() }, [showMembership])

  async function fetchTotals() {
    const monthStart = new Date().toISOString().slice(0, 7) + '-01'
    const results = await Promise.all(
      SALES_CARDS.map(c => supabaseAdmin.from(c.table).select('price').gte('created_at', monthStart))
    )
    const t = {}
    SALES_CARDS.forEach((c, i) => {
      t[c.table] = (results[i].data || []).reduce((s, r) => s + (r.price || 0), 0)
    })
    setTotals(t)

    if (showMembership) {
      const { data } = await supabaseAdmin.from('membership_stats')
        .select('total_members').order('week_start', { ascending: false }).limit(1)
      setMemberTotal(data?.[0]?.total_members ?? null)
    }
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
        {SALES_CARDS.map(c => (
          <ReportCard
            key={c.to}
            to={c.to}
            color={c.color}
            title={c.label}
            subtitle="Kuluva kuukausi"
            value={`${totals[c.table]?.toFixed(2)} €`}
            loading={loading}
          />
        ))}
        {showMembership && (
          <ReportCard
            to="/finance/raportointi/jasenyydet"
            color="var(--teal, #0D9488)"
            title="Jäsenyydet"
            subtitle="Viimeisin kirjaus"
            value={memberTotal != null ? memberTotal : '—'}
            loading={loading}
          />
        )}
      </div>
    </div>
  )
}
