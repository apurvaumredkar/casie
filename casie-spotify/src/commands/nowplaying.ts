/**
 * /nowplaying Command Handler
 *
 * Shows what the user is currently listening to on Spotify.
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

export async function handleNowPlaying(interaction: DiscordInteraction, env: Env): Promise<Response> {
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
    const state = await client.getPlaybackState();

    if (!state || !state.item) {
      return messageResponse('🎵 Nothing is currently playing.', true);
    }

    const track = state.item;
    const artists = track.artists.map((a) => a.name).join(', ');
    const progressMin = Math.floor((state.progress_ms || 0) / 60000);
    const progressSec = Math.floor(((state.progress_ms || 0) % 60000) / 1000);
    const durationMin = Math.floor(track.duration_ms / 60000);
    const durationSec = Math.floor((track.duration_ms % 60000) / 1000);

    const status = state.is_playing ? '▶️ Playing' : '⏸️ Paused';
    const deviceInfo = state.device ? `\n📱 Device: ${state.device.name} (${state.device.type})` : '';

    return messageResponse(
      `${status}\n\n` +
        `🎵 **${track.name}**\n` +
        `👤 ${artists}\n` +
        `💿 ${track.album.name}\n` +
        `⏱️ ${progressMin}:${progressSec.toString().padStart(2, '0')} / ${durationMin}:${durationSec.toString().padStart(2, '0')}` +
        deviceInfo,
      true
    );
  } catch (error) {
    if (error instanceof SpotifyAPIError) {
      if (error.status === 404 || error.status === 204) {
        return messageResponse('🎵 Nothing is currently playing.', true);
      }
    }
    console.error('Now playing error:', error);
    return messageResponse('❌ Failed to get playback info. Please try again.', true);
  }
}
