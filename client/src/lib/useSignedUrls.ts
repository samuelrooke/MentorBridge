import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Pictures (profile photos, message pictures) are in private buckets, so they're shown
// through signed links that work for an hour. Links are cached for the whole app.
const LIFETIME_S = 60 * 60
const cache = new Map<string, { url: string; expires: number }>()
const cacheKey = (bucket: string, path: string) => `${bucket}/${path}`
/** A cached link that is still valid for at least another minute. */
const isFresh = (bucket: string, path: string) => (cache.get(cacheKey(bucket, path))?.expires ?? 0) > Date.now() + 60_000

export function useSignedUrls(bucket: string, paths: (string | null | undefined)[]) {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))].sort()
  const key = wanted.join('|')
  const [, setVersion] = useState(0)

  useEffect(() => {
    const missing = (key ? key.split('|') : []).filter((path) => !isFresh(bucket, path))
    if (!missing.length) return
    let active = true
    void supabase.storage.from(bucket).createSignedUrls(missing, LIFETIME_S).then(({ data }) => {
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) cache.set(cacheKey(bucket, item.path), { url: item.signedUrl, expires: Date.now() + LIFETIME_S * 1000 })
      }
      if (active) setVersion((v) => v + 1)
    })
    return () => { active = false }
  }, [bucket, key])

  const urls: Record<string, string> = {}
  for (const path of wanted) {
    const hit = cache.get(cacheKey(bucket, path))
    if (hit) urls[path] = hit.url
  }
  return urls
}
