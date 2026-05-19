import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Calendar, Car, Stethoscope, Dumbbell, Users2,
  Gift, Building2, ClipboardList, CheckSquare, MessageSquare,
  FileText, Package, TrendingUp, BookOpen, LogOut, Menu
} from 'lucide-react'
import logo from '../../logo.svg'

const NAV = [
  { section: 'Yleistä' },
  { label: 'Etusivu',        href: '/',                  icon: LayoutDashboard },
  { label: 'Kalenteri',      href: '/calendar',          icon: Calendar },
  { label: 'Viestit',        href: '/communication',     icon: MessageSquare },
  { label: 'Tehtävät',       href: '/tasks',             icon: CheckSquare },

  { section: 'Myynti' },
  { label: 'Terapiamyynti',  href: '/finance/myynti/terapiamyynti',  icon: Stethoscope },
  { label: 'Valmennusmyynti',href: '/finance/myynti/valmennusmyynti',icon: Dumbbell },
  { label: 'Jäsenmyynti',    href: '/finance/myynti/jasenmyynti',    icon: Users2 },
  { label: 'Lahjakortit',    href: '/finance/lahjakortit',           icon: Gift },
  { label: 'Ajokirjaus',     href: '/timelog',           icon: Car },

  { section: 'Asiakkaat' },
  { label: 'Yritykset',      href: '/customers/yritykset',     icon: Building2 },
  { label: 'Sport & Hockey', href: '/customers/sport-hockey',  icon: Users2 },

  { section: 'Talous' },
  { label: 'Kirjanpito',     href: '/finance/kirjanpito',      icon: BookOpen },
  { label: 'Raportointi',    href: '/finance/raportointi',     icon: TrendingUp },

  { section: 'Hallinto' },
  { label: 'Henkilöstö',     href: '/employees',   icon: Users2,      roles: ['admin','hallitus'] },
  { label: 'Kyselyt',        href: '/surveys',     icon: ClipboardList },
  { label: 'Inventaario',    href: '/inventory',   icon: Package },
  { label: 'Dokumentit',     href: '/documents',   icon: FileText },
]

export default function Sidebar({ mobOpen, onClose }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const canSee = (item) => {
    if (!item.roles) return true
    return item.roles.includes(profile?.role)
  }

  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()
    : '?'

  return (
    <nav className={`sidebar${mobOpen ? ' mob-open' : ''}`}>
      <div className="sidebar-logo">
        <img src={logo} alt="Kuntomo" />
        <div className="sidebar-logo-sub">Hallintajärjestelmä</div>
      </div>

      <div className="sidebar-nav">
        {NAV.map((item, i) => {
          if (item.section) return <div key={i} className="nav-section-title">{item.section}</div>
          if (!canSee(item)) return null
          const Icon = item.icon
          return (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={onClose}
            >
              <Icon size={15} strokeWidth={2} />
              {item.label}
            </NavLink>
          )
        })}
      </div>

      <div className="sidebar-user">
        <div className="user-avatar">{initials}</div>
        <div className="user-info">
          <div className="user-name">{profile?.first_name} {profile?.last_name}</div>
          <div className="user-role">{profile?.role}</div>
        </div>
        <button className="signout-btn" title="Kirjaudu ulos" onClick={signOut}>
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  )
}
