// Issues short-lived signed URLs for private Storage objects.
// The caller must present a valid Supabase user JWT (Authorization: Bearer ...);
// only buckets in ALLOWED_BUCKETS are accessible. The service-role key never
// leaves the server.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'

const ALLOWED_BUCKETS = new Set(['receipts', 'documents'])
const EXPIRES_IN = 60 * 60 // 60 minutes

export default async function handler(req, res) {
  const params = req.method === 'GET' ? req.query : (req.body || {})
  const bucket = String(params.bucket || '')
  const path = String(params.path || '')

  if (!bucket || !path) {
    return res.status(400).json({ error: 'bucket and path are required' })
  }
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return res.status(403).json({ error: 'bucket not allowed' })
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

  // 2) Caller must be staff — i.e. have a profile row with at least one role.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, roles')
    .eq('id', userData.user.id)
    .maybeSingle()
  const rolesArr = Array.isArray(profile?.roles) ? profile.roles : []
  const hasRole = Boolean(profile?.role || rolesArr.length > 0)
  if (!hasRole) {
    return res.status(403).json({ error: 'no role assigned to profile' })
  }

  // 3) Issue signed URL for the requested object.
  const { data, error: signErr } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, EXPIRES_IN)
  if (signErr || !data?.signedUrl) {
    return res.status(500).json({ error: signErr?.message || 'sign failed' })
  }

  return res.status(200).json({ url: data.signedUrl, expiresIn: EXPIRES_IN })
}
