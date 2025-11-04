/**
 * Lightweight Rate Limiting for CASIE
 *
 * Uses Cloudflare KV to track request counts per user.
 * Simple and efficient - no heavy dependencies.
 */

// ========== TYPES ==========

export interface RateLimitConfig {
  maxRequests: number;   // Maximum requests allowed
  windowSeconds: number; // Time window in seconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;       // Unix timestamp when limit resets
  retryAfter?: number;   // Seconds to wait if rate limited
}

// ========== DEFAULT CONFIGS ==========

// Per-command rate limits
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  chat: { maxRequests: 20, windowSeconds: 60 },          // 20 requests per minute
  "web-search": { maxRequests: 10, windowSeconds: 60 },  // 10 searches per minute
  weather: { maxRequests: 15, windowSeconds: 60 },       // 15 requests per minute
  videos: { maxRequests: 10, windowSeconds: 60 },        // 10 requests per minute
  "lock-pc": { maxRequests: 5, windowSeconds: 300 },     // 5 requests per 5 minutes
  "pc-restart": { maxRequests: 3, windowSeconds: 300 },  // 3 requests per 5 minutes
  "pc-shutdown": { maxRequests: 3, windowSeconds: 300 }, // 3 requests per 5 minutes
  "pc-sleep": { maxRequests: 5, windowSeconds: 300 },    // 5 requests per 5 minutes
  default: { maxRequests: 30, windowSeconds: 60 },       // Default: 30 per minute
};

// ========== KEY GENERATION ==========

/**
 * Generate rate limit key for KV storage.
 * Format: rl:{command}:{user_id}
 */
function getRateLimitKey(command: string, userId: string): string {
  return `rl:${command}:${userId}`;
}

// ========== CORE FUNCTIONS ==========

/**
 * Check if a request is rate limited.
 * Returns result with allowed status and metadata.
 */
export async function checkRateLimit(
  kv: KVNamespace,
  command: string,
  userId: string
): Promise<RateLimitResult> {
  // Get rate limit config for this command
  const config = RATE_LIMITS[command] || RATE_LIMITS.default;
  const key = getRateLimitKey(command, userId);

  // Get current count from KV
  const data = await kv.get(key, "json");
  const now = Math.floor(Date.now() / 1000);

  if (!data) {
    // First request - allow and initialize counter
    await kv.put(
      key,
      JSON.stringify({ count: 1, startTime: now }),
      { expirationTtl: config.windowSeconds }
    );

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowSeconds,
    };
  }

  const record = data as { count: number; startTime: number };
  const elapsed = now - record.startTime;

  // If window has expired, reset counter
  if (elapsed >= config.windowSeconds) {
    await kv.put(
      key,
      JSON.stringify({ count: 1, startTime: now }),
      { expirationTtl: config.windowSeconds }
    );

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowSeconds,
    };
  }

  // Check if limit exceeded
  if (record.count >= config.maxRequests) {
    const resetAt = record.startTime + config.windowSeconds;
    const retryAfter = resetAt - now;

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter,
    };
  }

  // Increment counter
  const newCount = record.count + 1;
  await kv.put(
    key,
    JSON.stringify({ count: newCount, startTime: record.startTime }),
    { expirationTtl: config.windowSeconds - elapsed }
  );

  return {
    allowed: true,
    remaining: config.maxRequests - newCount,
    resetAt: record.startTime + config.windowSeconds,
  };
}

/**
 * Format rate limit error message for users.
 */
export function formatRateLimitMessage(command: string, result: RateLimitResult): string {
  const config = RATE_LIMITS[command] || RATE_LIMITS.default;
  const minutesOrSeconds = config.windowSeconds >= 60
    ? `${Math.floor(config.windowSeconds / 60)} minute${config.windowSeconds >= 120 ? 's' : ''}`
    : `${config.windowSeconds} seconds`;

  return `Rate limit exceeded for \`/${command}\`. You can make ${config.maxRequests} requests per ${minutesOrSeconds}. Please try again in ${result.retryAfter} seconds.`;
}

/**
 * Reset rate limit for a user (admin function).
 * Useful for testing or manually clearing limits.
 */
export async function resetRateLimit(
  kv: KVNamespace,
  command: string,
  userId: string
): Promise<void> {
  const key = getRateLimitKey(command, userId);
  await kv.delete(key);
}
