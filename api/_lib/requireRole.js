// Shared JWT + role check for admin API endpoints.
// Verifies the Authorization Bearer token belongs to a valid Supabase user
// AND that the user's profile has one of the allowed roles.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'

export async function requireRole(req, allowedRoles) {
  const auth = req.headers?.authorization || ''
  if (!auth.startsWith('Bearer ')) {
    return { error: 'missing bearer token', status: 401 }
  }
  const token = auth.slice('Bearer '.length)
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user) {
    return { error: 'invalid or expired token', status: 401 }
  }
  const [{ data: profile }, { data: employee, error: empError }] = await Promise.all([
    supabaseAdmin.from('profiles').select('role, roles').eq('id', userData.user.id).maybeSingle(),
    supabaseAdmin.from('employees').select('status').eq('auth_user_id', userData.user.id).maybeSingle(),
  ])
  if (empError) {
    return { error: 'authorization check failed', status: 503 }
  }
  if (employee?.status === 'inactive') {
    return { error: 'account inactive', status: 403 }
  }
  const rolesArr = Array.isArray(profile?.roles) ? profile.roles.map(String) : []
  if (profile?.role) rolesArr.push(String(profile.role))
  const matched = rolesArr.some(r => allowedRoles.includes(r))
  if (!matched) {
    return { error: 'insufficient role', status: 403 }
  }
  return { user: userData.user, roles: rolesArr }
}
