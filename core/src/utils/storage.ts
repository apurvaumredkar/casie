/**
 * Persistent Token Storage using Cloudflare KV
 *
 * Stores Spotify OAuth tokens persistently in KV storage.
 * Tokens survive worker restarts and are available globally.
 */

import { SpotifyTokens, OAuthState } from '../spotify/oauth';

// In-memory storage for OAuth states (short-lived, no longer needed with signed states)
const oauthStates = new Map<string, OAuthState>();

/**
 * Store OAuth state temporarily (for CSRF validation)
 */
export function storeOAuthState(state: string, data: OAuthState): void {
  oauthStates.set(state, data);
  // Note: Cleanup happens in consumeOAuthState via opportunistic cleanup
}

/**
 * Clean up expired OAuth states (older than 10 minutes)
 */
function cleanupExpiredStates(): void {
  const now = Date.now();
  const expirationTime = 10 * 60 * 1000; // 10 minutes

  for (const [state, data] of oauthStates.entries()) {
    if (now - data.timestamp > expirationTime) {
      oauthStates.delete(state);
    }
  }
}

/**
 * Retrieve and remove OAuth state
 */
export function consumeOAuthState(state: string): OAuthState | null {
  // Opportunistic cleanup of old states (1% chance per call)
  if (Math.random() < 0.01) {
    cleanupExpiredStates();
  }

  const data = oauthStates.get(state);
  if (!data) {
    return null;
  }

  // Check if state has expired (10 minutes)
  const now = Date.now();
  const expirationTime = 10 * 60 * 1000;
  if (now - data.timestamp > expirationTime) {
    oauthStates.delete(state);
    return null;
  }

  // Valid state - consume it (delete after use)
  oauthStates.delete(state);
  return data;
}

/**
 * Store user's Spotify tokens in KV
 */
export async function storeUserTokens(kv: KVNamespace, userId: string, tokens: SpotifyTokens): Promise<void> {
  await kv.put(`user:${userId}`, JSON.stringify(tokens));
}

/**
 * Retrieve user's Spotify tokens from KV
 */
export async function getUserTokens(kv: KVNamespace, userId: string): Promise<SpotifyTokens | null> {
  const data = await kv.get(`user:${userId}`, 'text');
  if (!data) return null;
  try {
    return JSON.parse(data) as SpotifyTokens;
  } catch {
    return null;
  }
}

/**
 * Remove user's tokens from KV (logout)
 */
export async function deleteUserTokens(kv: KVNamespace, userId: string): Promise<void> {
  await kv.delete(`user:${userId}`);
}

/**
 * Check if user has linked their Spotify account
 */
export async function isUserLinked(kv: KVNamespace, userId: string): Promise<boolean> {
  const data = await kv.get(`user:${userId}`);
  return data !== null;
}

// ========== Conversation Context Storage ==========

export interface ConversationContext {
  userId: string;
  lastQuery: string;
  lastIntent: string;
  lastResult: string;
  timestamp: number;
}

/**
 * Store conversation context for multi-turn queries
 * Context expires after 5 minutes
 */
export async function storeConversationContext(
  kv: KVNamespace,
  userId: string,
  context: ConversationContext
): Promise<void> {
  const expirationTtl = 5 * 60; // 5 minutes in seconds
  await kv.put(`context:${userId}`, JSON.stringify(context), { expirationTtl });
}

/**
 * Retrieve conversation context for follow-up queries
 */
export async function getConversationContext(
  kv: KVNamespace,
  userId: string
): Promise<ConversationContext | null> {
  const data = await kv.get(`context:${userId}`, 'text');
  if (!data) return null;
  try {
    return JSON.parse(data) as ConversationContext;
  } catch {
    return null;
  }
}

/**
 * Clear conversation context (logout or reset)
 */
export async function clearConversationContext(kv: KVNamespace, userId: string): Promise<void> {
  await kv.delete(`context:${userId}`);
}
