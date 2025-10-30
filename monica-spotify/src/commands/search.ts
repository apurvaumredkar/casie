/**
 * /spotify-search Command Handler
 *
 * Searches Spotify for tracks and displays results with Play/Cancel buttons.
 * Bypasses LLM for direct, fast search.
 */

import { DiscordInteraction, messageResponse, messageResponseWithComponents } from '../utils/discord';
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
    // Search Spotify for tracks (no LLM involved)
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

    // Create button components
    const components = [
      {
        type: 1, // ACTION_ROW
        components: [
          {
            type: 2, // BUTTON
            style: 3, // SUCCESS (green)
            label: 'Play',
            custom_id: `play_track_${trackUri}`,
          },
          {
            type: 2, // BUTTON
            style: 4, // DANGER (red)
            label: 'Cancel',
            custom_id: 'cancel_search',
          },
        ],
      },
    ];

    const message =
      `🔍 **Search Results for "${query}"**\n\n` +
      `🎵 **${trackName}**\n` +
      `👤 ${artistNames}\n` +
      `💿 ${albumName}\n\n` +
      (trackUrl ? `🔗 [Open in Spotify](${trackUrl})\n\n` : '') +
      `Press "Play" to start playback or "Cancel" to dismiss.`;

    return messageResponseWithComponents(message, components, true);
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
