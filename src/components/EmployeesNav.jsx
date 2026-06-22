import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const LINKS = [
  { label: 'Henkilöstö',          to: '/employees' },
  { label: 'Kausityöntekijät',    to: '/employees/kausityontekijat' },
  { label: 'Kyselyt ja ohjeet',   to: '/employees/kyselyt-ja-ohjeet' },
]

export default function EmployeesNav() {
  const { pathname } = useLocation()
  const { canAccess } = useAuth()

  const visible = LINKS.filter(l => canAccess(l.to))
  // No point showing a one-item sub-nav.
  if (visible.length < 2) return null

  return (
    <div className="sub-tabs" style={{ marginBottom: '1.75rem' }}>
      {visible.map(n => (
        <Link key={n.to} to={n.to} className={`sub-tab${pathname === n.to ? ' active' : ''}`}>
          {n.label}
        </Link>
      ))}
    </div>
  )
}
