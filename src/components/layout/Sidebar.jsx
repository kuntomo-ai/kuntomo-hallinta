import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Calendar, Car, Stethoscope, Dumbbell, Users2,
  Gift, Building2, ClipboardList, CheckSquare, MessageSquare,
  FileText, Package, TrendingUp, BookOpen, LogOut, Menu, Wrench, Settings
} from 'lucide-react'
import logo from '../../logo.svg'

// Roles that are NOT admin/manager — used to define per-item visibility.
// Items with no `roles` property are visible to everyone.
const MYYNTI      = ['myynti', 'terapia_valmennus', 'sport', 'respa']
const LAHJA       = ['terapia_valmennus', 'respa']
const TYOAIKA     = ['myynti', 'terapia_valmennus', 'huolto', 'sport', 'respa']
const ASIAKAS     = ['terapia_valmennus', 'respa']
const SPORT       = ['sport']
const TALOUS      = ['hallitus']
const HENK        = [] // admin/manager only — empty = blocked for non-admins
const VARASTO     = ['respa']
const LAITE       = ['respa', 'huolto']
const OMA_RAPORTI = ['myynti', 'terapia_valmennus']

const NAV = [
  { section: 'Yleistä' },
  { label: 'Etusivu',        href: '/',                         icon: LayoutDashboard },
  { label: 'Kalenteri',      href: '/calendar',                 icon: Calendar },
  { label: 'Viestit',        href: '/communication',            icon: MessageSquare },
  { label: 'Tehtävät',       href: '/tasks',                    icon: CheckSquare },

  { section: 'Myynti' },
  { label: 'Myynti',         href: '/finance/myynti',           icon: Stethoscope,   roles: MYYNTI },
  { label: 'Lahjakortit',    href: '/finance/lahjakortit',      icon: Gift,          roles: LAHJA },
  { label: 'Työaika / Ajo',  href: '/timelog',                  icon: Car,           roles: TYOAIKA },

  { section: 'Asiakkaat' },
  { label: 'Yritykset',      href: '/customers/yritykset',      icon: Building2,     roles: ASIAKAS },
  { label: 'Sport & Hockey', href: '/customers/sport-hockey',   icon: Users2,        roles: SPORT },

  { section: 'Talous' },
  { label: 'Kirjanpito',     href: '/finance/kirjanpito',       icon: BookOpen,      roles: TALOUS },
  { label: 'Raportointi',    href: '/finance/raportointi',      icon: TrendingUp,    roles: TALOUS },
  { label: 'Raportointi',    href: '/finance/raportointi/oma',  icon: TrendingUp,    exactRoles: OMA_RAPORTI },

  { section: 'Hallinto' },
  { label: 'Henkilöstö',         href: '/employees',                        icon: Users2,        roles: HENK },
  { label: 'Kausityöntekijät',  href: '/employees/kausityontekijat',       icon: Users2,        roles: HENK },
  { label: 'Kyselyt',        href: '/surveys',                  icon: ClipboardList },
  { label: 'Inventaario',    href: '/inventory',                icon: Package,       roles: VARASTO },
  { label: 'Laiteluettelo',  href: '/laiteluettelo',            icon: Wrench,        roles: LAITE },
  { label: 'Dokumentit',     href: '/documents',                icon: FileText },
]

export default function Sidebar({ mobOpen, onClose }) {
  const { profile, signOut } = useAuth()

  const role = profile?.role
  const isPrivileged = role === 'admin' || role === 'manager'

  function canSee(item) {
    if (item.exactRoles) return item.exactRoles.includes(role)  // strict: no admin bypass
    if (item.adminHide && isPrivileged) return false
    if (isPrivileged) return true
    if (!item.roles) return true           // no restriction → everyone
    if (item.roles.length === 0) return false  // empty array → admin-only
    return item.roles.includes(role)
  }

  // Build visible nav, suppressing section headers with no visible items
  const visibleNav = []
  let pendingSection = null
  for (const item of NAV) {
    if (item.section) {
      pendingSection = item
    } else if (canSee(item)) {
      if (pendingSection) { visibleNav.push(pendingSection); pendingSection = null }
      visibleNav.push(item)
    }
  }

  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()
    : '?'

  return (
    <nav className={`sidebar${mobOpen ? ' mob-open' : ''}`}>
      <div className="sidebar-logo">
        <img src={logo} alt="Kuntomo" />
        <div className="sidebar-logo-sub">Kuntomo ERP</div>
      </div>

      <div className="sidebar-nav">
        {visibleNav.map((item, i) => {
          if (item.section) return <div key={i} className="nav-section-title">{item.section}</div>
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
        <NavLink to="/settings" onClick={onClose} title="Omat tiedot" style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit', borderRadius: 'var(--radius)', transition: 'background .15s', padding: '.15rem .3rem', margin: '-.15rem -.3rem' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{profile?.first_name} {profile?.last_name}</div>
            <div className="user-role">{profile?.role}</div>
          </div>
        </NavLink>
        <button className="signout-btn" title="Kirjaudu ulos" onClick={signOut}>
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  )
}
