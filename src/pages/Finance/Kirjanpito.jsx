import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const NAV_LINKS = [
  { label: 'Yleistä', to: '/finance/kirjanpito' },
  { label: 'Tase', to: '/finance/kirjanpito/tase' },
  { label: 'Tuloslaskelma', to: '/finance/kirjanpito/tulos' },
  { label: 'Kassavirta', to: '/finance/kirjanpito/kassavirta' },
  { label: 'Raportit', to: '/finance/kirjanpito/raportit' },
]

const QUICK_CARDS = [
  { label: 'Tase', desc: 'Vastaavaa ja vastattavaa', to: '/finance/kirjanpito/tase' },
  { label: 'Tuloslaskelma', desc: 'Tuotot ja kulut', to: '/finance/kirjanpito/tulos' },
  { label: 'Kassavirta', desc: 'Tulot ja menot', to: '/finance/kirjanpito/kassavirta' },
  { label: 'Raportit', desc: 'Dokumentit ja raportit', to: '/finance/kirjanpito/raportit' },
]

export default function Kirjanpito() {
  const location = useLocation()
  const [stats, setStats] = useState({ myynti: 0, kulut: 0, tulos: 0, kassa: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    setLoading(true)
    const monthStart = new Date().toISOString().slice(0, 7) + '-01'
    const [tulosRes, kassaRes] = await Promise.all([
      supabase.from('tulos_account_entries').select('account_group, amount').gte('period', monthStart.slice(0, 7)),
      supabase.from('kassavirta_entries').select('amount, entry_type').gte('entry_date', monthStart),
    ])
    const tulokset = tulosRes.data || []
    const kassaEntries = kassaRes.data || []

    const myynti = tulokset.filter(r => r.account_group === 'tuotot').reduce((s, r) => s + (r.amount || 0), 0)
    const kulut = tulokset.filter(r => r.account_group === 'kulut').reduce((s, r) => s + (r.amount || 0), 0)
    const kassaTulot = kassaEntries.filter(r => r.entry_type === 'tulo').reduce((s, r) => s + (r.amount || 0), 0)
    const kassaMenot = kassaEntries.filter(r => r.entry_type === 'meno').reduce((s, r) => s + (r.amount || 0), 0)

    setStats({ myynti, kulut, tulos: myynti - kulut, kassa: kassaTulot - kassaMenot })
    setLoading(false)
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Kirjanpito</h1>
          <p className="page-subtitle">Talouden hallinta ja seuranta</p>
        </div>
      </div>

      <div className="sub-tabs" style={{ marginBottom: '1.75rem' }}>
        {NAV_LINKS.map(n => (
          <Link key={n.to} to={n.to} className={`sub-tab${location.pathname === n.to ? ' active' : ''}`}>{n.label}</Link>
        ))}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Kuluvan kuun myynti</div>
          <div className="stat-value gold">{loading ? '...' : stats.myynti.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kuluvan kuun kulut</div>
          <div className="stat-value">{loading ? '...' : stats.kulut.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tulos (kk)</div>
          <div className="stat-value" style={{ color: stats.tulos >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {loading ? '...' : stats.tulos.toFixed(2)} €
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kassatilanne (kk)</div>
          <div className="stat-value" style={{ color: stats.kassa >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {loading ? '...' : stats.kassa.toFixed(2)} €
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {QUICK_CARDS.map(c => (
          <Link key={c.to} to={c.to} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--violet)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--violet-subtle)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = '' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '.35rem' }}>{c.label}</div>
              <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
