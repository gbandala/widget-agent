/**
 * Rate Limiter — Upstash Redis en producción, in-memory fallback en dev.
 *
 * En producción configurar:
 *   UPSTASH_REDIS_REST_URL=
 *   UPSTASH_REDIS_REST_TOKEN=
 */

// ---- In-memory fallback (dev / no Redis configured) ----

interface RateLimitEntry {
  count: number
  resetAt: number
}

const memoryStore = new Map<string, RateLimitEntry>()

function cleanExpired() {
  const now = Date.now()
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetAt < now) memoryStore.delete(key)
  }
}

function checkRateLimitMemory(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  cleanExpired()
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count }
}

// ---- Upstash Redis (production) ----

let upstashPerIP: unknown = null
let upstashPerToken: unknown = null
let upstashInitialized = false

async function getUpstashLimiters() {
  if (upstashInitialized) return { perIP: upstashPerIP, perToken: upstashPerToken }
  upstashInitialized = true

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) return { perIP: null, perToken: null }

  try {
    const { Redis } = await import('@upstash/redis')
    const { Ratelimit } = await import('@upstash/ratelimit')
    const redis = new Redis({ url, token })

    upstashPerIP = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        Number(process.env.WIDGET_RATE_LIMIT_RPM ?? 20),
        '1 m'
      ),
      prefix: 'widget:ip',
    })

    upstashPerToken = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        Number(process.env.WIDGET_TOKEN_RATE_LIMIT_RPH ?? 200),
        '1 h'
      ),
      prefix: 'widget:token',
    })
  } catch (err) {
    console.error('[RateLimiter] Failed to initialize Upstash:', err)
  }

  return { perIP: upstashPerIP, perToken: upstashPerToken }
}

// ---- Per-session velocity guard (in-memory) ----
// Blocks machine-speed submissions: a human can't type and send in under 1 second.

const velocityStore = new Map<string, number>()
const VELOCITY_MIN_MS = 1000

export function checkMessageVelocity(sessionId: string): { allowed: boolean } {
  const now = Date.now()
  const last = velocityStore.get(sessionId)
  velocityStore.set(sessionId, now)
  if (last !== undefined && now - last < VELOCITY_MIN_MS) {
    return { allowed: false }
  }
  return { allowed: true }
}

// ---- Public API ----

export type RateLimitType = 'ip' | 'token'

export async function checkRateLimit(
  identifier: string,
  type: RateLimitType
): Promise<{ allowed: boolean; remaining: number }> {
  const { perIP, perToken } = await getUpstashLimiters()
  const limiter = type === 'ip' ? perIP : perToken

  if (limiter) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (limiter as any).limit(identifier)
      return { allowed: result.success, remaining: result.remaining }
    } catch (err) {
      console.error('[RateLimiter] Upstash check failed, falling back to memory:', err)
    }
  }

  // Fallback in-memory
  const { limit, windowMs } =
    type === 'ip'
      ? { limit: Number(process.env.WIDGET_RATE_LIMIT_RPM ?? 20), windowMs: 60_000 }
      : { limit: Number(process.env.WIDGET_TOKEN_RATE_LIMIT_RPH ?? 200), windowMs: 3_600_000 }

  return checkRateLimitMemory(`${type}:${identifier}`, limit, windowMs)
}
