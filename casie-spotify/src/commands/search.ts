/**
 * /play Command Handler
 *
 * Searches Spotify for tracks and immediately plays the top result.
 * No confirmation buttons - instant playback.
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

export async function handleSpotifySearch(interaction: DiscordInteraction, env: Env): Promise<Response> {
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

  // Get search query from command options
  const query = interaction.data?.options?.find((opt) => opt.name === 'query')?.value as string | undefined;

  if (!query || query.trim().length === 0) {
    return messageResponse('❌ Please provide a search query.', true);
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
    // Search Spotify for tracks
    const results = await client.search(query, ['track'], 5);

    if (!results || !results.tracks || results.tracks.items.length === 0) {
      return messageResponse(
        `🔍 No tracks found for "${query}". Try a different search term.`,
        true
      );
    }

    const topTrack = results.tracks.items[0];
    const trackName = topTrack.name;
    const artistNames = topTrack.artists.map((a: any) => a.name).join(', ');
    const albumName = topTrack.album.name;
    const trackUri = topTrack.uri;
    const trackUrl = topTrack.external_urls?.spotify || '';

    // Immediately play the track
    try {
      // Get available devices
      const devices = await client.getDevices();

      if (!devices || devices.length === 0) {
        return messageResponse(
          `❌ No active Spotify devices found. Please open Spotify on any device and try again.`,
          true
        );
      }

      // Find an active device or use the first available one
      let targetDevice = devices.find((d: any) => d.is_active);
      if (!targetDevice) {
        targetDevice = devices[0];
      }

      // Start playback with specific track URI
      await (client as any).request(`/me/player/play?device_id=${targetDevice.id}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [trackUri] }),
      });

      // Send success message
      const message =
        `▶️ **Now Playing**\n\n` +
        `🎵 **${trackName}**\n` +
        `👤 ${artistNames}\n` +
        `💿 ${albumName}\n\n` +
        (trackUrl ? `🔗 [Open in Spotify](${trackUrl})` : '');

      return messageResponse(message, true);
    } catch (playbackError) {
      if (playbackError instanceof SpotifyAPIError) {
        console.error('Spotify playback error:', playbackError.status, playbackError.body);

        // Handle common playback errors
        if (playbackError.status === 404) {
          return messageResponse(
            `❌ No active device found. Please open Spotify on any device and try again.`,
            true
          );
        } else if (playbackError.status === 403) {
          return messageResponse(
            `❌ Premium account required for playback control. Please upgrade to Spotify Premium.`,
            true
          );
        }

        return messageResponse(
          `❌ Failed to start playback (${playbackError.status}). Please try again.`,
          true
        );
      }

      console.error('Playback error:', playbackError);
      return messageResponse('❌ Failed to start playback. Please try again.', true);
    }
  } catch (error) {
    if (error instanceof SpotifyAPIError) {
      console.error('Spotify search error:', error.status, error.body);
      return messageResponse(
        `❌ Spotify search failed (${error.status}). Please try again.`,
        true
      );
    }
    console.error('Search error:', error);
    return messageResponse('❌ Failed to search Spotify. Please try again.', true);
  }
}
