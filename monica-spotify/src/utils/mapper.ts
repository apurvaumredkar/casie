/**
 * Intent Mapper
 *
 * Maps parsed LLM intents to Spotify API calls using the SpotifyClient.
 * Executes the appropriate action based on the interpreted intent.
 */

import { Intent } from '../llm/interpreter';
import { SpotifyClient, SpotifyAPIError } from '../spotify/client';

export interface ExecutionResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Execute an intent using the Spotify API
 * @param intent - Parsed intent from LLM
 * @param spotifyClient - Authenticated Spotify client
 * @returns Execution result with user-friendly message
 */
export async function executeIntent(
  intent: Intent,
  spotifyClient: SpotifyClient
): Promise<ExecutionResult> {
  try {
    switch (intent.intent) {
      case 'play':
        return await handlePlay(intent, spotifyClient);

      case 'pause':
        return await handlePause(spotifyClient);

      case 'next':
        return await handleNext(spotifyClient);

      case 'previous':
        return await handlePrevious(spotifyClient);

      case 'search':
        return await handleSearch(intent, spotifyClient);

      case 'create_playlist':
        return await handleCreatePlaylist(intent, spotifyClient);

      case 'add_to_playlist':
        return await handleAddToPlaylist(intent, spotifyClient);

      case 'unknown':
      default:
        return {
          success: false,
          message: "❌ Couldn't interpret your request. Try using a direct command like `/play`, `/pause`, or `/next`.",
        };
    }
  } catch (error) {
    console.error('Intent execution error:', error);
    return {
      success: false,
      message: '❌ An error occurred while executing your request.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handle play intent (with optional search target)
 */
async function handlePlay(
  intent: Intent,
  client: SpotifyClient
): Promise<ExecutionResult> {
  try {
    // If target specified, search and play
    if (intent.target) {
      const searchResults = await client.search(intent.target, ['track'], 5);

      if (!searchResults.tracks || searchResults.tracks.items.length === 0) {
        return {
          success: false,
          message: `❌ No results found for "${intent.target}". Try a different search term.`,
        };
      }

      const topTrack = searchResults.tracks.items[0];

      // Play the track
      await client.play();
      // Note: To play specific track, we'd need to use queue or context
      // For simplicity, just start playback and show what was found

      return {
        success: true,
        message: `🎵 Found: **${topTrack.name}** by ${topTrack.artists.map((a: any) => a.name).join(', ')}\n▶️ Starting playback...`,
      };
    } else {
      // Just resume playback
      await client.play();
      return {
        success: true,
        message: '▶️ Playback resumed!',
      };
    }
  } catch (error) {
    if (error instanceof SpotifyAPIError) {
      if (error.status === 404) {
        return {
          success: false,
          message: '❌ No active Spotify device found. Please open Spotify on one of your devices.',
        };
      }
      if (error.status === 403) {
        return {
          success: false,
          message: '❌ Cannot start playback. You need an active Spotify Premium subscription.',
        };
      }
    }
    throw error;
  }
}

/**
 * Handle pause intent
 */
async function handlePause(client: SpotifyClient): Promise<ExecutionResult> {
  try {
    await client.pause();
    return {
      success: true,
      message: '⏸️ Playback paused!',
    };
  } catch (error) {
    if (error instanceof SpotifyAPIError && error.status === 404) {
      return {
        success: false,
        message: '❌ No active Spotify device found.',
      };
    }
    throw error;
  }
}

/**
 * Handle next track intent
 */
async function handleNext(client: SpotifyClient): Promise<ExecutionResult> {
  try {
    await client.skipToNext();
    return {
      success: true,
      message: '⏭️ Skipped to next track!',
    };
  } catch (error) {
    if (error instanceof SpotifyAPIError && error.status === 404) {
      return {
        success: false,
        message: '❌ No active Spotify device found.',
      };
    }
    throw error;
  }
}

/**
 * Handle previous track intent
 */
async function handlePrevious(client: SpotifyClient): Promise<ExecutionResult> {
  try {
    await client.skipToPrevious();
    return {
      success: true,
      message: '⏮️ Skipped to previous track!',
    };
  } catch (error) {
    if (error instanceof SpotifyAPIError && error.status === 404) {
      return {
        success: false,
        message: '❌ No active Spotify device found.',
      };
    }
    throw error;
  }
}

/**
 * Handle search intent (search and display results)
 */
async function handleSearch(
  intent: Intent,
  client: SpotifyClient
): Promise<ExecutionResult> {
  if (!intent.target) {
    return {
      success: false,
      message: '❌ No search term provided.',
    };
  }

  try {
    const results = await client.search(intent.target, ['track', 'artist', 'album'], 5);

    let message = `🔍 **Search results for "${intent.target}":**\n\n`;

    // Show tracks
    if (results.tracks && results.tracks.items.length > 0) {
      message += '**Tracks:**\n';
      results.tracks.items.slice(0, 3).forEach((track: any, i: number) => {
        message += `${i + 1}. ${track.name} - ${track.artists.map((a: any) => a.name).join(', ')}\n`;
      });
      message += '\n';
    }

    // Show artists
    if (results.artists && results.artists.items.length > 0) {
      message += '**Artists:**\n';
      results.artists.items.slice(0, 2).forEach((artist: any, i: number) => {
        message += `${i + 1}. ${artist.name}\n`;
      });
      message += '\n';
    }

    // Show albums
    if (results.albums && results.albums.items.length > 0) {
      message += '**Albums:**\n';
      results.albums.items.slice(0, 2).forEach((album: any, i: number) => {
        message += `${i + 1}. ${album.name} - ${album.artists.map((a: any) => a.name).join(', ')}\n`;
      });
    }

    return {
      success: true,
      message: message.trim() || '❌ No results found.',
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Handle create playlist intent
 */
async function handleCreatePlaylist(
  intent: Intent,
  client: SpotifyClient
): Promise<ExecutionResult> {
  if (!intent.playlist_name) {
    return {
      success: false,
      message: '❌ No playlist name provided.',
    };
  }

  try {
    // Get current user to create playlist
    const user = await client.getCurrentUser();
    const playlist = await client.createPlaylist(
      user.id,
      intent.playlist_name,
      'Created by SpotiBot',
      false
    );

    return {
      success: true,
      message: `✅ Created playlist: **${playlist.name}**\n${playlist.external_urls.spotify}`,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Handle add to playlist intent
 */
async function handleAddToPlaylist(
  intent: Intent,
  _client: SpotifyClient
): Promise<ExecutionResult> {
  if (!intent.playlist_name) {
    return {
      success: false,
      message: '❌ No playlist name provided.',
    };
  }

  // This is a complex operation that requires:
  // 1. Finding the current track
  // 2. Finding the playlist by name
  // 3. Adding the track to the playlist
  // For MVP, we'll return a helpful message

  return {
    success: false,
    message: `❌ Adding to playlists is not yet fully implemented. You can create a playlist with the name "${intent.playlist_name}" using the Spotify app.`,
  };
}
