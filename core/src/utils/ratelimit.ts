/**
 * Rate Limiter
 *
 * Simple in-memory rate limiting for LLM queries to prevent abuse.
 * Implements a per-user cooldown period.
 */

interface RateLimitEntry {
  lastRequestTime: number;
  requestCount: number;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const COOLDOWN_MS = 10000; // 10 seconds between LLM queries per user

/**
 * Clean up old entries from rate limit store
 * Called manually instead of using setInterval (which isn't allowed in Workers global scope)
 */
function cleanupOldEntries(): void {
  const now = Date.now();
  for (const [userId, entry] of rateLimitStore.entries()) {
    if (now - entry.lastRequestTime > COOLDOWN_MS * 2) {
      rateLimitStore.delete(userId);
    }
  }
}

/**
 * Check if a user is rate limited
 * @param userId - Discord user ID
 * @returns Object with isLimited flag and remaining cooldown time
 */
export function checkRateLimit(userId: string): {
  isLimited: boolean;
  remainingMs: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  // Opportunistic cleanup every 100 checks
  if (Math.random() < 0.01) {
    cleanupOldEntries();
  }

  if (!entry) {
    return { isLimited: false, remainingMs: 0 };
  }

  const timeSinceLastRequest = now - entry.lastRequestTime;

  if (timeSinceLastRequest < COOLDOWN_MS) {
    return {
      isLimited: true,
      remainingMs: COOLDOWN_MS - timeSinceLastRequest,
    };
  }

  return { isLimited: false, remainingMs: 0 };
}

/**
 * Record a request for rate limiting
 * @param userId - Discord user ID
 */
export function recordRequest(userId: string): void {
  rateLimitStore.set(userId, {
    lastRequestTime: Date.now(),
    requestCount: (rateLimitStore.get(userId)?.requestCount || 0) + 1,
  });
}

/**
 * Get remaining cooldown time in a human-readable format
 * @param remainingMs - Remaining milliseconds
 * @returns Formatted string (e.g., "5 seconds")
 */
export function formatCooldown(remainingMs: number): string {
  const seconds = Math.ceil(remainingMs / 1000);
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}
