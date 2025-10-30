/**
 * /playlists Command Handler
 *
 * Lists the user's Spotify playlists.
 */

import { DiscordInteraction, messageResponse } from '../utils/discord';
import { SpotifyClient } from '../spotify/client';
import { getUserTokens, isUserLinked, storeUserTokens } from '../utils/storage';
import { isTokenExpired, refreshAccessToken } from '../spotify/oauth';

export interface Env {
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  SPOTIFY_TOKENS: KVNamespace;
}

export async function handlePlaylists(interaction: DiscordInteraction, env: Env): Promise<Response> {
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
    // Get user profile to check ownership
    const user = await client.getCurrentUser();

    // Get all user playlists (increased limit to get more playlists)
    const allPlaylists = await client.getUserPlaylists(50);

    // Filter for playlists owned by the user
    const ownedPlaylists = allPlaylists.filter(p => p.owner?.id === user.id);

    if (ownedPlaylists.length === 0) {
      return messageResponse('📝 You have no playlists created by you yet. Create one on Spotify!', true);
    }

    // Limit display to top 10
    const displayPlaylists = ownedPlaylists.slice(0, 10);
    const hasMore = ownedPlaylists.length > 10;

    const playlistList = displayPlaylists
      .map((p, i) => `${i + 1}. **${p.name}** (${p.tracks.total} tracks)\n   ${p.external_urls.spotify}`)
      .join('\n\n');

    const moreText = hasMore ? `\n\n_... and ${ownedPlaylists.length - 10} more_` : '';

    return messageResponse(`📝 **Your Created Playlists** (${ownedPlaylists.length} total)\n\n${playlistList}${moreText}`, true);
  } catch (error) {
    console.error('Playlists error:', error);
    return messageResponse('❌ Failed to fetch playlists. Please try again.', true);
  }
}
