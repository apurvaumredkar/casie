/**
 * Discord Utilities
 *
 * Provides signature verification and response helpers for Discord interactions.
 * Based on Discord's Ed25519 signature verification spec.
 */

// Discord interaction types
export enum InteractionType {
  PING = 1,
  APPLICATION_COMMAND = 2,
  MESSAGE_COMPONENT = 3,
  APPLICATION_COMMAND_AUTOCOMPLETE = 4,
  MODAL_SUBMIT = 5,
}

// Discord interaction response types
export enum InteractionResponseType {
  PONG = 1,
  CHANNEL_MESSAGE_WITH_SOURCE = 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5,
  DEFERRED_UPDATE_MESSAGE = 6,
  UPDATE_MESSAGE = 7,
}

export interface DiscordInteraction {
  type: InteractionType;
  id: string;
  token: string;
  application_id?: string;
  data?: {
    name: string;
    options?: Array<{
      name: string;
      value: string | number | boolean;
    }>;
  };
  member?: {
    user: {
      id: string;
      username: string;
    };
  };
  user?: {
    id: string;
    username: string;
  };
}

/**
 * Verify Discord request signature using Ed25519
 * @param request - The incoming request
 * @param publicKey - Discord application public key
 * @returns Whether the signature is valid
 */
export async function verifyDiscordRequest(
  request: Request,
  publicKey: string
): Promise<boolean> {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');

  if (!signature || !timestamp) {
    return false;
  }

  const body = await request.text();

  // Import the public key for verification
  const key = await crypto.subtle.importKey(
    'raw',
    hexToBuffer(publicKey),
    { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' },
    false,
    ['verify']
  );

  // Verify the signature
  const isValid = await crypto.subtle.verify(
    'NODE-ED25519',
    key,
    hexToBuffer(signature),
    new TextEncoder().encode(timestamp + body)
  );

  return isValid;
}

/**
 * Convert hex string to ArrayBuffer
 */
function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

/**
 * Create a JSON response for Discord interactions
 */
export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Create a PONG response for Discord PING interactions
 */
export function pongResponse(): Response {
  return jsonResponse({ type: InteractionResponseType.PONG });
}

/**
 * Create a message response for Discord interactions
 */
export function messageResponse(content: string, ephemeral = false): Response {
  return jsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: ephemeral ? 64 : 0, // 64 = EPHEMERAL flag
    },
  });
}

/**
 * Create a deferred response for long-running operations
 */
export function deferredResponse(ephemeral = false): Response {
  return jsonResponse({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: ephemeral ? 64 : 0,
    },
  });
}

/**
 * Send a follow-up message to a Discord interaction
 */
export async function sendFollowup(
  token: string,
  content: string,
  applicationId: string
): Promise<Response> {
  const webhookUrl = `https://discord.com/api/v10/webhooks/${applicationId}/${token}`;

  return fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

/**
 * Edit the original deferred message
 */
export async function editOriginalMessage(
  token: string,
  content: string,
  applicationId: string
): Promise<Response> {
  const webhookUrl = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`;

  return fetch(webhookUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}
