// Issues short-lived signed URLs for private Storage objects.
// The caller must present a valid Supabase user JWT (Authorization: Bearer ...);
// path-level authorization is verified via DB lookup (supabaseAdmin) before signing.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'
import { rateLimit } from '../_lib/rateLimit.js'

const ALLOWED_BUCKETS = new Set(['receipts', 'documents'])
const EXPIRES_IN = 60 * 60 // 60 minutes

// Roles that see all terapia/documents receipts regardless of seller_id
const RECEIPT_ADMIN_ROLES = ['admin', 'hallitus', 'manager']
// Roles that see all kirjanpito documents (matches supabase_rls_tighten.sql line 93)
const DOC_ADMIN_ROLES = ['admin', 'hallitus', 'manager']
// Roles allowed to access any lahjakortti receipt (Option A: all page-access roles)
const LAHJAKORTTI_ROLES = ['admin', 'hallitus', 'manager', 'terapia_valmennus', 'respa']

function hasOneOf(role, rolesArr, allowed) {
  return allowed.includes(role) || rolesArr.some(r => allowed.includes(r))
}

function isValidPath(p) {
  if (!p || typeof p !== 'string' || p.length > 512) return false
  if (p.startsWith('/')) return false
  if (p.includes('..') || p.includes('\0')) return false
  return true
}

async function authorizeReceipts(path, userId, role, rolesArr) {
  if (path.startsWith('terapia/')) {
    const { data } = await supabaseAdmin
      .from('terapiamyynti')
      .select('seller_id')
      .eq('receipt_url', path)
      .maybeSingle()
    if (!data) return false
    if (hasOneOf(role, rolesArr, RECEIPT_ADMIN_ROLES)) return true
    return data.seller_id === userId

  } else if (path.startsWith('lahjakortti/')) {
    const { data } = await supabaseAdmin
      .from('lahjakortit')
      .select('id')
      .eq('receipt_url', path)
      .maybeSingle()
    if (!data) return false
    return hasOneOf(role, rolesArr, LAHJAKORTTI_ROLES)
  }

  return false
}

async function authorizeDocuments(path, role, rolesArr) {
  const { data } = await supabaseAdmin
    .from('kirjanpito_documents')
    .select('visible_to')
    .eq('file_url', path)
    .maybeSingle()
  if (!data) return false
  const v = data.visible_to
  if (!v || v === 'all') return true
  if (hasOneOf(role, rolesArr, DOC_ADMIN_ROLES)) return true
  return role === v || rolesArr.includes(v)
}

export default async function handler(req, res) {
  const params = req.method === 'GET' ? req.query : (req.body || {})
  const bucket = String(params.bucket || '')
  const path = String(params.path || '')

  if (!bucket || !path) {
    return res.status(400).json({ error: 'bucket and path are required' })
  }
  if (!ALLOWED_BUCKETS.has(bucket) || !isValidPath(path)) {
    return res.status(403).json({ error: 'forbidden' })
  }

  // 1) Validate user JWT — must be a real, currently-valid Supabase auth session.
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing bearer token' })
  }
  const token = auth.slice('Bearer '.length)
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'invalid or expired token' })
  }
  const userId = userData.user.id

  // 2) Rate limit per authenticated user — prevents token-holder from enumerating files.
  // Key is userId only so the limit is per-identity regardless of IP.
  const rl = await rateLimit({ name: 'signed-url', key: userId, limit: 120, window: '1 h' })
  if (!rl.ok) {
    res.setHeader('Retry-After', String(Math.ceil((rl.reset - Date.now()) / 1000)))
    return res.status(429).json({ error: 'Liian monta pyyntöä. Yritä hetken kuluttua uudelleen.' })
  }

  // 3) Caller must be active staff — profile with at least one role + not inactive.
  const [{ data: profile }, { data: employee, error: empErr }] = await Promise.all([
    supabaseAdmin.from('profiles').select('role, roles').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('employees').select('status').eq('auth_user_id', userId).maybeSingle(),
  ])
  if (empErr) return res.status(503).json({ error: 'authorization check failed' })
  if (employee?.status === 'inactive') return res.status(403).json({ error: 'account inactive' })
  const role = profile?.role ?? null
  const rolesArr = Array.isArray(profile?.roles) ? profile.roles : []
  if (!role && rolesArr.length === 0) {
    return res.status(403).json({ error: 'forbidden' })
  }

  // 4) Path-level authorization — DB lookup with service_role bypasses RLS.
  let allowed = false
  if (bucket === 'receipts') {
    allowed = await authorizeReceipts(path, userId, role, rolesArr)
  } else if (bucket === 'documents') {
    allowed = await authorizeDocuments(path, role, rolesArr)
  }
  if (!allowed) {
    return res.status(403).json({ error: 'forbidden' })
  }

  // 5) Issue signed URL for the requested object.
  const { data, error: signErr } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, EXPIRES_IN)
  if (signErr || !data?.signedUrl) {
    return res.status(500).json({ error: 'sign failed' })
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ url: data.signedUrl, expiresIn: EXPIRES_IN })
}
