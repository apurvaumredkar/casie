/**
 * Spotify OAuth Utilities
 *
 * Handles OAuth 2.0 authorization code flow for Spotify API.
 * See: https://developer.spotify.com/documentation/web-api/tutorials/code-flow
 */

export interface SpotifyTokens {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token: string;
  expires_at: number; // Timestamp when token expires
}

export interface OAuthState {
  userId: string;
  timestamp: number;
}

/**
 * Generate HMAC signature for state parameter
 */
async function generateStateSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify HMAC signature for state parameter
 */
async function verifyStateSignature(data: string, signature: string, secret: string): Promise<boolean> {
  const expectedSignature = await generateStateSignature(data, secret);
  return signature === expectedSignature;
}

/**
 * Generate a random state string for CSRF protection (deprecated - use signed state)
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create signed OAuth state (stateless, no storage needed)
 */
export async function createSignedState(data: OAuthState, secret: string): Promise<string> {
  const encoded = btoa(JSON.stringify(data));
  const signature = await generateStateSignature(encoded, secret);
  return `${encoded}.${signature}`;
}

/**
 * Verify and decode signed OAuth state
 */
export async function verifySignedState(state: string, secret: string): Promise<OAuthState | null> {
  try {
    const [encoded, signature] = state.split('.');
    if (!encoded || !signature) {
      return null;
    }

    // Verify signature
    const isValid = await verifyStateSignature(encoded, signature, secret);
    if (!isValid) {
      return null;
    }

    // Decode data
    const data: OAuthState = JSON.parse(atob(encoded));

    // Check expiration (10 minutes)
    const now = Date.now();
    const expirationTime = 10 * 60 * 1000;
    if (now - data.timestamp > expirationTime) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Encode OAuth state data into a secure string (deprecated - use signed state)
 */
export function encodeState(data: OAuthState): string {
  return btoa(JSON.stringify(data));
}

/**
 * Decode OAuth state data from string (deprecated - use verify signed state)
 */
export function decodeState(state: string): OAuthState | null {
  try {
    return JSON.parse(atob(state));
  } catch {
    return null;
  }
}

/**
 * Generate Spotify authorization URL
 * @param clientId - Spotify client ID
 * @param redirectUri - OAuth callback URL
 * @param state - CSRF protection state
 * @param scopes - Spotify API scopes to request
 */
export function getAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  scopes: string[] = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private',
  ]
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
    scope: scopes.join(' '),
    show_dialog: 'false',
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<SpotifyTokens> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data: any = await response.json();

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    scope: data.scope,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<SpotifyTokens> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data: any = await response.json();

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    scope: data.scope,
    expires_in: data.expires_in,
    refresh_token: refreshToken, // Spotify may not return new refresh token
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Check if access token is expired
 */
export function isTokenExpired(tokens: SpotifyTokens): boolean {
  // Add 5 minute buffer to avoid edge cases
  return Date.now() >= tokens.expires_at - 5 * 60 * 1000;
}
