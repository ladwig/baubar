const WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS = 20  // per user per window

const buckets = new Map<string, number[]>()

export function checkRateLimit(userId: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const windowStart = now - WINDOW_MS

  const timestamps = (buckets.get(userId) ?? []).filter((t) => t > windowStart)

  if (timestamps.length >= MAX_REQUESTS) {
    const retryAfterMs = timestamps[0]! + WINDOW_MS - now
    buckets.set(userId, timestamps)
    return { allowed: false, retryAfterMs }
  }

  timestamps.push(now)
  buckets.set(userId, timestamps)
  return { allowed: true, retryAfterMs: 0 }
}
