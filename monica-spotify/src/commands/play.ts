/**
 * /play Command Handler
 *
 * Resumes or starts playback on the user's active Spotify device.
 */

import { DiscordInteraction, messageResponse } from '../utils/discord';
import { SpotifyClient, SpotifyAPIError } from '../spotify/client';
import { getUserTokens, isUserLinked, storeUserTokens } from '../utils/storage';
import { isTokenExpired, refreshAccessToken } from '../spotify/oauth';

export interface Env {
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  SPOTIFY_TOKENS: KVNamespace;
}

export async function handlePlay(interaction: DiscordInteraction, env: Env): Promise<Response> {
  const userId = interaction.member?.user?.id || interaction.user?.id;

  if (!userId) {
    return messageResponse('❌ Could not identify user.', true);
  }

  // Check if user has linked their Spotify account
  if (!(await isUserLinked(env.SPOTIFY_TOKENS, userId))) {
    return messageResponse(
      '❌ You need to link your Spotify account first! Use `/linkspotify` to get started.',
      true
    );
  }

  let tokens = await getUserTokens(env.SPOTIFY_TOKENS, userId);

  if (!tokens) {
    return messageResponse(
      '❌ Your session has expired. Please relink with `/linkspotify`.',
      true
    );
  }

  // Refresh token if expired
  if (isTokenExpired(tokens)) {
    try {
      tokens = await refreshAccessToken(
        tokens.refresh_token,
        env.SPOTIFY_CLIENT_ID,
        env.SPOTIFY_CLIENT_SECRET
      );
      await storeUserTokens(env.SPOTIFY_TOKENS, userId, tokens);
    } catch (error) {
      return messageResponse(
        '❌ Failed to refresh your Spotify token. Please relink your account with `/linkspotify`.',
        true
      );
    }
  }

  const client = new SpotifyClient(tokens.access_token);

  try {
    const result = await client.playSmartly();
    const deviceInfo = result.device ? ` on ${result.device.name} (${result.device.type})` : '';
    return messageResponse(`▶️ Playback started${deviceInfo}!`);
  } catch (error) {
    if (error instanceof SpotifyAPIError) {
      if (error.status === 404) {
        return messageResponse(
          '❌ No Spotify devices available. Please open Spotify on one of your devices and try again.',
          true
        );
      }
      if (error.status === 403) {
        return messageResponse(
          '❌ Cannot start playback. You need an active Spotify Premium subscription.',
          true
        );
      }
    }
    console.error('Play error:', error);
    return messageResponse('❌ Failed to start playback. Please try again.', true);
  }
}
