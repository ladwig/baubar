// Module-level in-memory cache. Lives in the browser process per user session.
// Each user gets their own JS context so no cross-user leakage.

interface CacheEntry {
  data: unknown
  expiresAt: number
}

const store = new Map<string, CacheEntry>()

export async function cachedFetch<T>(url: string, ttlMs: number): Promise<T> {
  const hit = store.get(url)
  if (hit && hit.expiresAt > Date.now()) return hit.data as T

  const res = await fetch(url)
  const data = await res.json()
  if (res.ok) store.set(url, { data, expiresAt: Date.now() + ttlMs })
  return data as T
}

// Removes all cache entries whose key starts with any of the given prefixes.
export function invalidate(...prefixes: string[]) {
  for (const key of store.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) store.delete(key)
  }
}

// Convenience TTL constants
export const TTL = {
  REFERENCE: 5 * 60_000,  // statuses, field defs, company/contact lists for dropdowns
  LIST: 30_000,            // paginated list views
  DETAIL: 30_000,          // entity detail pages
  // Activity tabs always use plain fetch() — no caching
} as const
