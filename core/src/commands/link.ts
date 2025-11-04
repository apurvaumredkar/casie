/**
 * /linkspotify Command Handler
 *
 * Generates a Spotify OAuth authorization URL for the user to link their account.
 */

import { DiscordInteraction, messageResponse } from '../utils/discord';
import { getAuthorizationUrl, createSignedState } from '../spotify/oauth';

export interface Env {
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_REDIRECT_URI: string;
  SPOTIFY_STATE_SECRET: string; // Private secret for OAuth state signing
}

export async function handleLinkSpotify(interaction: DiscordInteraction, env: Env): Promise<Response> {
  // Get user ID from interaction
  const userId = interaction.member?.user?.id || interaction.user?.id;

  if (!userId) {
    return messageResponse('❌ Could not identify user.', true);
  }

  // Create signed state for CSRF protection (stateless - no storage needed)
  const stateData = {
    userId,
    timestamp: Date.now(),
  };

  const signedState = await createSignedState(stateData, env.SPOTIFY_STATE_SECRET);

  // Generate authorization URL
  const authUrl = getAuthorizationUrl(
    env.SPOTIFY_CLIENT_ID,
    env.SPOTIFY_REDIRECT_URI,
    signedState
  );

  return messageResponse(
    `🎵 **Link your Spotify account**\n\n` +
      `Click the link below to authorize CASIE Spotify to access your Spotify account:\n\n` +
      `${authUrl}\n\n` +
      `This link will expire in 10 minutes.`,
    true // Ephemeral - only visible to the user
  );
}
