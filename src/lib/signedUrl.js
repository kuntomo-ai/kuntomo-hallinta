import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Cache signed URLs in-memory while they're still fresh so we don't ping the
// server on every re-render. Signed URLs themselves are valid for 60 min;
// we expire the cache at 55 min so the next fetch isn't right at the edge.
const cache = new Map()
const CACHE_MS = 55 * 60 * 1000

function pathFromStored(stored, bucket) {
  if (!stored) return null
  // Old-style public URL e.g. https://x.supabase.co/storage/v1/object/public/receipts/foo.jpg
  const re = new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${bucket}/(.+?)(?:\\?.*)?$`)
  const m = String(stored).match(re)
  if (m) return m[1]
  return String(stored)
}

export async function getSignedUrl(bucket, stored) {
  const path = pathFromStored(stored, bucket)
  if (!path) return null

  const key = `${bucket}/${path}`
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return cached.url

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return null

  const qs = `bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`
  let res
  try {
    res = await fetch(`/api/storage/signed-url?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return null
  }
  if (!res.ok) return null
  const body = await res.json().catch(() => null)
  if (!body?.url) return null

  cache.set(key, { url: body.url, expires: Date.now() + CACHE_MS })
  return body.url
}

export function useSignedUrl(bucket, stored) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (!stored) { setUrl(null); return }
    getSignedUrl(bucket, stored).then(u => { if (!cancelled) setUrl(u) })
    return () => { cancelled = true }
  }, [bucket, stored])
  return url
}
