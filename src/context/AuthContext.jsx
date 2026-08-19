import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Route-prefix → allowed non-admin roles (undefined = all roles allowed)
const ROUTE_PERMISSIONS = {
  '/timelog':                  ['myynti', 'terapia_valmennus', 'huolto', 'sport', 'respa'],
  '/employees':                [],  // admin/manager only
  '/inventory':                ['respa'],
  '/laiteluettelo':            ['respa', 'huolto'],
  '/finance/myynti':           ['myynti', 'terapia_valmennus', 'sport', 'respa'],
  '/finance/lahjakortit':      ['terapia_valmennus', 'respa'],
  '/finance/kirjanpito':       ['hallitus'],
  '/finance/raportointi/oma':       ['myynti', 'terapia_valmennus', 'sport'],
  '/finance/raportointi/mobilepay': ['hallitus', 'respa'],
  '/finance/raportointi':           ['hallitus'],
  '/customers/yritykset':      ['terapia_valmennus', 'respa'],
  '/customers/sport-hockey':   ['sport'],
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    // Ei-aktiivinen työntekijä kirjataan välittömästi ulos ennen kuin profiili
    // ehtii latautua — muuten pääsee näkemään sivut. Ohitetaan tarkistus
    // jos työntekijärivi ei löydy (esim. ulkopuoliset admin-tunnukset).
    const { data: emp } = await supabase.from('employees').select('status').eq('auth_user_id', userId).maybeSingle()
    if (emp && emp.status === 'inactive') {
      await supabase.auth.signOut()
      sessionStorage.setItem('kuntomo-inactive-signout', '1')
      setProfile(null)
      setUser(null)
      setLoading(false)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  const signOut = () => supabase.auth.signOut()

  // Multi-role: prefer the roles array, fall back to the singular role
  // for profiles that pre-date the migration.
  const roles = Array.isArray(profile?.roles) && profile.roles.length > 0
    ? profile.roles
    : (profile?.role ? [profile.role] : [])
  const role = roles[0] ?? null
  const hasRole = r => roles.includes(r)
  const hasAnyRole = rs => rs.some(r => roles.includes(r))
  const isAdmin = hasRole('admin') || hasRole('manager')
  const isHallitus = hasRole('hallitus')

  function canAccess(path) {
    if (roles.length === 0) return false
    // Strict routes — admin/manager bypass does not apply.
    if (path.startsWith('/instagram')) return hasRole('admin') || hasRole('respa')
    // Kyselyt ja ohjeet lives under /employees but should remain open to all roles.
    if (path.startsWith('/employees/kyselyt-ja-ohjeet')) return true
    // Kausityöntekijät — admin/manager + respa (otherwise /employees is admin-only).
    if (path.startsWith('/employees/kausityontekijat')) return isAdmin || hasRole('respa')
    if (isAdmin) return true
    const entry = Object.entries(ROUTE_PERMISSIONS).find(([prefix]) => path.startsWith(prefix))
    if (!entry) return true
    const [, allowed] = entry
    if (allowed.length === 0) return false
    return hasAnyRole(allowed)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, role, roles, hasRole, hasAnyRole, isAdmin, isHallitus, canAccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
