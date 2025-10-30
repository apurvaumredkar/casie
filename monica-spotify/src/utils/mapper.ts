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
 * Build Spotify search query from extracted entities
 * Uses simple concatenated search for better compatibility
 *
 * @param intent - Intent with extracted entities
 * @returns Spotify query string (e.g., "Paper Rings Taylor Swift")
 */
function buildSpotifyQuery(intent: Intent): string {
  const parts: string[] = [];

  // Concatenate entities in natural order for better search results
  // Note: Spotify's field filters (track:, artist:) are unreliable, so we use plain text
  if (intent.track) {
    parts.push(intent.track);
  }
  if (intent.artist) {
    parts.push(intent.artist);
  }
  if (intent.album) {
    parts.push(intent.album);
  }
  if (intent.genre) {
    parts.push(intent.genre);
  }

  // Add generic query for ambiguous requests
  if (intent.query) {
    parts.push(intent.query);
  }

  // If no entities extracted, fall back to legacy target field
  if (parts.length === 0 && intent.target) {
    return intent.target;
  }

  return parts.join(' ');
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

      case 'list_playlist_tracks':
        return await handleListPlaylistTracks(intent, spotifyClient);

      case 'list_artist_albums':
        return await handleListArtistAlbums(intent, spotifyClient);

      case 'list_album_tracks':
        return await handleListAlbumTracks(intent, spotifyClient);

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
    // Check if any search entities or target specified
    const hasSearchQuery = intent.track || intent.artist || intent.album || intent.genre || intent.query || intent.target;

    if (hasSearchQuery) {
      // Build structured Spotify query from entities
      const spotifyQuery = buildSpotifyQuery(intent);

      console.log('[handlePlay] Searching with structured query:', spotifyQuery);

      const searchResults = await client.search(spotifyQuery, ['track'], 5);

      if (!searchResults.tracks || searchResults.tracks.items.length === 0) {
        return {
          success: false,
          message: `❌ No results found for "${spotifyQuery}". Try a different search term.`,
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
 * Handle search intent (search and play first result)
 */
async function handleSearch(
  intent: Intent,
  client: SpotifyClient
): Promise<ExecutionResult> {
  // Build structured query from entities
  const spotifyQuery = buildSpotifyQuery(intent);

  if (!spotifyQuery) {
    return {
      success: false,
      message: '❌ No search term provided.',
    };
  }

  console.log('[handleSearch] Searching with structured query:', spotifyQuery);

  try {
    // Always prioritize tracks for playback
    const results = await client.search(spotifyQuery, ['track'], 10);

    // Check if results exist and contain tracks
    if (!results || !results.tracks || results.tracks.items.length === 0) {
      return {
        success: false,
        message: `❌ No tracks found for "${spotifyQuery}". Try a different search term.`,
      };
    }

    const topTrack = results.tracks.items[0];
    const trackUri = topTrack.uri;
    const trackName = topTrack.name;
    const artistNames = topTrack.artists.map((a: any) => a.name).join(', ');

    console.log('[handleSearch] Playing track:', trackUri, trackName, 'by', artistNames);

    // Play the first track result
    try {
      await playTrackByUri(client, trackUri);

      return {
        success: true,
        message: `▶️ Now playing: **${trackName}** by ${artistNames}`,
      };
    } catch (playError) {
      if (playError instanceof SpotifyAPIError && playError.status === 404) {
        return {
          success: false,
          message: `🎵 Found: **${trackName}** by ${artistNames}\n\n❌ No active Spotify device found.\n\nOpen Spotify on any device, or use the Web Player:\nhttps://open.spotify.com`,
        };
      }
      throw playError;
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Play a track by its Spotify URI
 */
async function playTrackByUri(client: SpotifyClient, trackUri: string): Promise<void> {
  // Use the Spotify Play API with uris parameter to play specific track
  await (client as any).request('/me/player/play', {
    method: 'PUT',
    body: JSON.stringify({ uris: [trackUri] }),
  });
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

/**
 * Handle list playlist tracks intent
 */
async function handleListPlaylistTracks(
  intent: Intent,
  client: SpotifyClient
): Promise<ExecutionResult> {
  const playlistName = intent.playlist;

  if (!playlistName) {
    return {
      success: false,
      message: '❌ No playlist name provided.',
    };
  }

  try {
    // First, search for the playlist by name
    const searchResults = await client.search(playlistName, ['playlist'], 5);

    if (!searchResults || !searchResults.playlists || searchResults.playlists.items.length === 0) {
      return {
        success: false,
        message: `❌ Playlist "${playlistName}" not found.`,
      };
    }

    const playlist = searchResults.playlists.items[0];
    const playlistId = playlist.id;

    // Get tracks from the playlist
    const tracksData = await client.getPlaylistTracks(playlistId, 15);

    if (!tracksData || !tracksData.items || tracksData.items.length === 0) {
      return {
        success: false,
        message: `📋 Playlist **${playlist.name}** is empty.`,
      };
    }

    // Format track list
    const trackList = tracksData.items
      .slice(0, 15)
      .map((item: any, index: number) => {
        const track = item.track;
        const trackName = track.name;
        const artistNames = track.artists.map((a: any) => a.name).join(', ');
        return `${index + 1}. **${trackName}** - ${artistNames}`;
      })
      .join('\n');

    const total = tracksData.total || tracksData.items.length;
    const moreInfo = total > 15 ? `\n\n...and ${total - 15} more tracks` : '';

    return {
      success: true,
      message: `🎵 **${playlist.name}** (${total} tracks)\n\n${trackList}${moreInfo}\n\n🔗 [Open in Spotify](${playlist.external_urls.spotify})`,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Handle list artist albums intent
 */
async function handleListArtistAlbums(
  intent: Intent,
  client: SpotifyClient
): Promise<ExecutionResult> {
  const artistName = intent.artist;

  if (!artistName) {
    return {
      success: false,
      message: '❌ No artist name provided.',
    };
  }

  try {
    // Search for the artist
    const searchResults = await client.search(artistName, ['artist'], 1);

    if (!searchResults || !searchResults.artists || searchResults.artists.items.length === 0) {
      return {
        success: false,
        message: `❌ Artist "${artistName}" not found.`,
      };
    }

    const artist = searchResults.artists.items[0];
    const artistId = artist.id;

    // Get albums by artist
    const albumsData = await client.getArtistAlbums(artistId, 15);

    if (!albumsData || !albumsData.items || albumsData.items.length === 0) {
      return {
        success: false,
        message: `💿 No albums found for **${artist.name}**.`,
      };
    }

    // Format album list
    const albumList = albumsData.items
      .slice(0, 15)
      .map((album: any, index: number) => {
        const albumName = album.name;
        const releaseYear = album.release_date ? album.release_date.split('-')[0] : 'Unknown';
        return `${index + 1}. **${albumName}** (${releaseYear})`;
      })
      .join('\n');

    const total = albumsData.total || albumsData.items.length;
    const moreInfo = total > 15 ? `\n\n...and ${total - 15} more albums` : '';

    return {
      success: true,
      message: `💿 **${artist.name}** Albums (${total} total)\n\n${albumList}${moreInfo}\n\n🔗 [View on Spotify](${artist.external_urls.spotify})`,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Handle list album tracks intent
 */
async function handleListAlbumTracks(
  intent: Intent,
  client: SpotifyClient
): Promise<ExecutionResult> {
  const albumName = intent.album;

  if (!albumName) {
    return {
      success: false,
      message: '❌ No album name provided.',
    };
  }

  try {
    // Search for the album
    const searchResults = await client.search(albumName, ['album'], 1);

    if (!searchResults || !searchResults.albums || searchResults.albums.items.length === 0) {
      return {
        success: false,
        message: `❌ Album "${albumName}" not found.`,
      };
    }

    const album = searchResults.albums.items[0];
    const albumId = album.id;

    // Get tracks from the album
    const tracksData = await client.getAlbumTracks(albumId);

    if (!tracksData || !tracksData.items || tracksData.items.length === 0) {
      return {
        success: false,
        message: `💿 Album **${album.name}** has no tracks listed.`,
      };
    }

    // Format track list
    const trackList = tracksData.items
      .map((track: any, index: number) => {
        const trackName = track.name;
        const duration = formatDuration(track.duration_ms);
        return `${index + 1}. **${trackName}** (${duration})`;
      })
      .join('\n');

    const artistNames = album.artists.map((a: any) => a.name).join(', ');

    return {
      success: true,
      message: `💿 **${album.name}** by ${artistNames}\n\n${trackList}\n\n🔗 [Open in Spotify](${album.external_urls.spotify})`,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Format duration from milliseconds to mm:ss
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
