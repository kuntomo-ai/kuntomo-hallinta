import { Link, useLocation } from 'react-router-dom'

const LINKS = [
  { label: 'Yleistä',       to: '/finance/kirjanpito' },
  { label: 'Tase',          to: '/finance/kirjanpito/tase' },
  { label: 'Tuloslaskelma', to: '/finance/kirjanpito/tulos' },
  { label: 'Kassavirta',    to: '/finance/kirjanpito/kassavirta' },
  { label: 'Tuo CSV',       to: '/finance/kirjanpito/tuonti' },
]

export default function KirjanpitoNav() {
  const { pathname } = useLocation()
  return (
    <div className="sub-tabs" style={{ marginBottom: '1.75rem' }}>
      {LINKS.map(n => (
        <Link key={n.to} to={n.to} className={`sub-tab${pathname === n.to ? ' active' : ''}`}>
          {n.label}
        </Link>
      ))}
    </div>
  )
}
