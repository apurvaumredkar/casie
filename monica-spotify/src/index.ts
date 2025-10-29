/**
 * SpotiBot - Spotify Discord Bot Worker
 *
 * Main entry point for the Cloudflare Worker that handles Discord interactions
 * and Spotify API integration.
 *
 * Routes:
 * - POST / - Discord interaction webhook
 * - GET /oauth/callback - Spotify OAuth callback
 * - GET /health - Health check endpoint
 */

import {
  verifyDiscordRequest,
  pongResponse,
  messageResponse,
  deferredResponse,
  editOriginalMessage,
  InteractionType,
  DiscordInteraction,
} from './utils/discord';
import { handleLinkSpotify } from './commands/link';
import { handlePlay } from './commands/play';
import { handlePause } from './commands/pause';
import { handleNext } from './commands/next';
import { handlePrevious } from './commands/previous';
import { handleNowPlaying } from './commands/nowplaying';
import { handlePlaylists } from './commands/playlists';
import { exchangeCodeForTokens, verifySignedState } from './spotify/oauth';
import { storeUserTokens, getUserTokens, isUserLinked } from './utils/storage';
import { interpretQuery } from './llm/interpreter';
import { executeIntent } from './utils/mapper';
import { SpotifyClient } from './spotify/client';
import { isTokenExpired, refreshAccessToken } from './spotify/oauth';
import { checkRateLimit, recordRequest, formatCooldown } from './utils/ratelimit';

export interface Env {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_BOT_TOKEN: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  SPOTIFY_REDIRECT_URI: string;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL?: string;
  SPOTIFY_TOKENS: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle Spotify OAuth callback
    if (url.pathname === '/oauth/callback' && request.method === 'GET') {
      return handleOAuthCallback(url, env);
    }

    // Health check endpoint
    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', bot: 'SpotiBot' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle Discord interactions at root path (default for Discord webhooks)
    if (url.pathname === '/' && request.method === 'POST') {
      return handleDiscordInteraction(request, env, ctx);
    }

    // GET request to root returns a simple message
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response('SpotiBot - Spotify Discord Bot', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  },
};

/**
 * Handle Discord interaction webhook
 */
async function handleDiscordInteraction(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Verify Discord signature
  const isValid = await verifyDiscordRequest(
    request.clone(),
    env.DISCORD_PUBLIC_KEY
  );

  if (!isValid) {
    return new Response('Invalid request signature', { status: 401 });
  }

  const interaction: DiscordInteraction = await request.json();

  // Handle PING interactions (Discord verification)
  if (interaction.type === InteractionType.PING) {
    return pongResponse();
  }

  // Handle application commands
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const commandName = interaction.data?.name;

    try {
      switch (commandName) {
        case 'linkspotify':
          return await handleLinkSpotify(interaction, env);

        case 'play':
          return await handlePlay(interaction, env);

        case 'pause':
          return await handlePause(interaction, env);

        case 'next':
          return await handleNext(interaction, env);

        case 'previous':
          return await handlePrevious(interaction, env);

        case 'nowplaying':
          return await handleNowPlaying(interaction, env);

        case 'playlists':
          return await handlePlaylists(interaction, env);

        case 'spotify':
          return await handleSpotifyNL(interaction, env, ctx);

        default:
          return messageResponse(
            `❌ Unknown command: ${commandName}`,
            true
          );
      }
    } catch (error) {
      console.error('Command error:', error);
      return messageResponse(
        '❌ An error occurred while processing your command. Please try again.',
        true
      );
    }
  }

  return new Response('Unknown interaction type', { status: 400 });
}

/**
 * Handle natural language Spotify command with LLM
 */
async function handleSpotifyNL(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const userId = interaction.member?.user?.id || interaction.user?.id;

  if (!userId) {
    return messageResponse('❌ Could not identify user.', true);
  }

  // Check if user has linked Spotify
  if (!(await isUserLinked(env.SPOTIFY_TOKENS, userId))) {
    return messageResponse(
      '❌ You need to link your Spotify account first! Use `/linkspotify` to get started.',
      true
    );
  }

  // Check rate limit
  const rateLimit = checkRateLimit(userId);
  if (rateLimit.isLimited) {
    return messageResponse(
      `⏱️ Please wait ${formatCooldown(rateLimit.remainingMs)} before using /spotify again.`,
      true
    );
  }

  // Get query from command options
  const query = interaction.data?.options?.find((opt) => opt.name === 'query')?.value as string;

  if (!query || query.trim().length === 0) {
    return messageResponse('❌ Please provide a query. Example: `/spotify play some jazz`', true);
  }

  // Record request for rate limiting
  recordRequest(userId);

  // Send deferred response (LLM call may take a few seconds)
  const deferredResp = deferredResponse(false);

  // Process in background
  ctx.waitUntil(
    (async () => {
      try {
        // Get user tokens from KV
        let tokens = await getUserTokens(env.SPOTIFY_TOKENS, userId);

        if (!tokens) {
          await editOriginalMessage(
            interaction.token,
            '❌ Your session has expired. Please relink with `/linkspotify`.',
            interaction.application_id || env.DISCORD_BOT_TOKEN.split('.')[0]
          );
          return;
        }

        // Refresh if expired
        if (isTokenExpired(tokens)) {
          try {
            tokens = await refreshAccessToken(
              tokens.refresh_token,
              env.SPOTIFY_CLIENT_ID,
              env.SPOTIFY_CLIENT_SECRET
            );
            await storeUserTokens(env.SPOTIFY_TOKENS, userId, tokens);
          } catch (error) {
            await editOriginalMessage(
              interaction.token,
              '❌ Failed to refresh your Spotify token. Please relink with `/linkspotify`.',
              interaction.application_id || env.DISCORD_BOT_TOKEN.split('.')[0]
            );
            return;
          }
        }

        // Interpret query with LLM
        const intent = await interpretQuery(query, env);

        if (intent.intent === 'unknown') {
          await editOriginalMessage(
            interaction.token,
            `❌ Couldn't understand "${query}". Try a direct command like \`/play\`, \`/pause\`, or \`/next\`.`,
            interaction.application_id || env.DISCORD_BOT_TOKEN.split('.')[0]
          );
          return;
        }

        // Execute intent with Spotify API
        const client = new SpotifyClient(tokens.access_token);
        const result = await executeIntent(intent, client);

        // Send result to Discord
        await editOriginalMessage(
          interaction.token,
          result.message,
          interaction.application_id || env.DISCORD_BOT_TOKEN.split('.')[0]
        );
      } catch (error) {
        console.error('Spotify NL command error:', error);
        await editOriginalMessage(
          interaction.token,
          '❌ An error occurred while processing your request. Please try again.',
          interaction.application_id || env.DISCORD_BOT_TOKEN.split('.')[0]
        );
      }
    })()
  );

  return deferredResp;
}

/**
 * Handle Spotify OAuth callback
 */
async function handleOAuthCallback(url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Handle user denying authorization
  if (error) {
    return new Response(
      htmlResponse(
        '❌ Authorization Denied',
        'You denied access to your Spotify account. Please try again if you want to use SpotiBot.'
      ),
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return new Response(
      htmlResponse('❌ Invalid Callback', 'Missing authorization code or state.'),
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Verify signed state (stateless - no storage lookup needed)
  const stateData = await verifySignedState(state, env.DISCORD_PUBLIC_KEY);

  if (!stateData) {
    return new Response(
      htmlResponse(
        '❌ Invalid or Expired State',
        'The authorization request has expired or is invalid. Please try linking your account again with /linkspotify'
      ),
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  try {
    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(
      code,
      env.SPOTIFY_CLIENT_ID,
      env.SPOTIFY_CLIENT_SECRET,
      env.SPOTIFY_REDIRECT_URI
    );

    // Store tokens for the user in KV
    await storeUserTokens(env.SPOTIFY_TOKENS, stateData.userId, tokens);

    return new Response(
      htmlResponse(
        '✅ Spotify Account Linked!',
        'Your Spotify account has been successfully linked to SpotiBot. You can now use commands like /play, /pause, /next, and more in Discord!'
      ),
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    return new Response(
      htmlResponse(
        '❌ Authorization Failed',
        'Failed to complete the authorization process. Please try linking your account again.'
      ),
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * Generate a simple HTML response for OAuth callbacks
 */
function htmlResponse(title: string, message: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
    }
    .container {
      background: white;
      padding: 3rem;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      max-width: 500px;
      text-align: center;
    }
    h1 {
      font-size: 2rem;
      margin: 0 0 1rem 0;
    }
    p {
      font-size: 1.1rem;
      line-height: 1.6;
      color: #555;
    }
    .close-info {
      margin-top: 2rem;
      font-size: 0.9rem;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="close-info">You can close this window and return to Discord.</div>
  </div>
</body>
</html>
  `.trim();
}
