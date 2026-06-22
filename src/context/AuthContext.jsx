import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'

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
  '/finance/raportointi/oma':  ['myynti', 'terapia_valmennus', 'sport'],
  '/finance/raportointi':      ['hallitus'],
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
    const { data } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  const signOut = () => supabase.auth.signOut()

  const role = profile?.role ?? null
  const isAdmin = role === 'admin' || role === 'manager'
  const isHallitus = role === 'hallitus'

  function canAccess(path) {
    if (!role) return false
    // Strict routes — admin/manager bypass does not apply.
    if (path.startsWith('/instagram')) return role === 'admin' || role === 'respa'
    // Kyselyt ja ohjeet lives under /employees but should remain open to all roles.
    if (path.startsWith('/employees/kyselyt-ja-ohjeet')) return true
    if (isAdmin) return true
    const entry = Object.entries(ROUTE_PERMISSIONS).find(([prefix]) => path.startsWith(prefix))
    if (!entry) return true
    const [, allowed] = entry
    if (allowed.length === 0) return false
    return allowed.includes(role)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, role, isAdmin, isHallitus, canAccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
