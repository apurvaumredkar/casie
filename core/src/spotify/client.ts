/**
 * Spotify API Client
 *
 * Provides methods to interact with Spotify Web API.
 * See: https://developer.spotify.com/documentation/web-api
 */

export interface SpotifyUser {
  id: string;
  display_name: string;
  email?: string;
}

export interface SpotifyPlaybackState {
  is_playing: boolean;
  item?: {
    name: string;
    artists: Array<{ name: string }>;
    album: { name: string };
    duration_ms: number;
  };
  progress_ms?: number;
  device?: {
    name: string;
    type: string;
  };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  owner?: {
    id: string;
    display_name: string;
  };
  tracks: {
    total: number;
  };
  external_urls: {
    spotify: string;
  };
}

export class SpotifyAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: any
  ) {
    super(message);
    this.name = 'SpotifyAPIError';
  }
}

export class SpotifyClient {
  private baseUrl = 'https://api.spotify.com/v1';

  constructor(private accessToken: string) {}

  /**
   * Make a request to Spotify API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new SpotifyAPIError(
        `Spotify API error: ${response.status}`,
        response.status,
        body
      );
    }

    // Some endpoints return 204 No Content or empty responses
    if (response.status === 204) {
      return null as T;
    }

    // Check if response explicitly has zero content
    const contentLength = response.headers.get('content-length');
    if (contentLength === '0') {
      return null as T;
    }

    // Try to parse JSON, but handle empty responses gracefully
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      return null as T;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('Failed to parse Spotify API response:', error);
      console.error('Response text was:', text);
      return null as T;
    }
  }

  /**
   * Get current user's profile
   */
  async getCurrentUser(): Promise<SpotifyUser> {
    return this.request<SpotifyUser>('/me');
  }

  /**
   * Get current playback state
   */
  async getPlaybackState(): Promise<SpotifyPlaybackState | null> {
    try {
      return await this.request<SpotifyPlaybackState>('/me/player');
    } catch (error) {
      // 204 No Content means no active devices
      if (error instanceof SpotifyAPIError && error.status === 204) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get currently playing track
   */
  async getCurrentlyPlaying(): Promise<SpotifyPlaybackState | null> {
    try {
      return await this.request<SpotifyPlaybackState>('/me/player/currently-playing');
    } catch (error) {
      if (error instanceof SpotifyAPIError && error.status === 204) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Start or resume playback
   */
  async play(deviceId?: string): Promise<void> {
    const endpoint = deviceId
      ? `/me/player/play?device_id=${deviceId}`
      : '/me/player/play';
    await this.request(endpoint, { method: 'PUT' });
  }

  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    await this.request('/me/player/pause', { method: 'PUT' });
  }

  /**
   * Skip to next track
   */
  async skipToNext(): Promise<void> {
    await this.request('/me/player/next', { method: 'POST' });
  }

  /**
   * Skip to previous track
   */
  async skipToPrevious(): Promise<void> {
    await this.request('/me/player/previous', { method: 'POST' });
  }

  /**
   * Set playback volume
   */
  async setVolume(volumePercent: number): Promise<void> {
    const volume = Math.max(0, Math.min(100, volumePercent));
    await this.request(`/me/player/volume?volume_percent=${volume}`, {
      method: 'PUT',
    });
  }

  /**
   * Toggle shuffle mode
   */
  async setShuffle(state: boolean): Promise<void> {
    await this.request(`/me/player/shuffle?state=${state}`, { method: 'PUT' });
  }

  /**
   * Set repeat mode
   */
  async setRepeat(state: 'track' | 'context' | 'off'): Promise<void> {
    await this.request(`/me/player/repeat?state=${state}`, { method: 'PUT' });
  }

  /**
   * Get user's playlists
   */
  async getUserPlaylists(limit = 20): Promise<SpotifyPlaylist[]> {
    const response = await this.request<{ items: SpotifyPlaylist[] }>(
      `/me/playlists?limit=${limit}`
    );
    return response.items;
  }

  /**
   * Create a new playlist
   */
  async createPlaylist(
    userId: string,
    name: string,
    description = '',
    isPublic = false
  ): Promise<SpotifyPlaylist> {
    return this.request<SpotifyPlaylist>(`/users/${userId}/playlists`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        public: isPublic,
      }),
    });
  }

  /**
   * Add tracks to a playlist
   */
  async addTracksToPlaylist(
    playlistId: string,
    trackUris: string[]
  ): Promise<void> {
    await this.request(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris: trackUris }),
    });
  }

  /**
   * Get tracks from a playlist
   */
  async getPlaylistTracks(playlistId: string, limit = 50): Promise<any> {
    return this.request(`/playlists/${playlistId}/tracks?limit=${limit}`);
  }

  /**
   * Get albums by an artist
   */
  async getArtistAlbums(artistId: string, limit = 50): Promise<any> {
    return this.request(`/artists/${artistId}/albums?limit=${limit}&include_groups=album,single`);
  }

  /**
   * Get tracks from an album
   */
  async getAlbumTracks(albumId: string): Promise<any> {
    return this.request(`/albums/${albumId}/tracks`);
  }

  /**
   * Search for tracks, albums, artists, or playlists
   */
  async search(
    query: string,
    types: Array<'track' | 'album' | 'artist' | 'playlist'> = ['track'],
    limit = 10
  ): Promise<any> {
    const typeString = types.join(',');
    return this.request(
      `/search?q=${encodeURIComponent(query)}&type=${typeString}&limit=${limit}`
    );
  }

  /**
   * Get available devices
   */
  async getDevices(): Promise<Array<{ id: string; name: string; type: string; is_active: boolean }>> {
    const response = await this.request<{ devices: any[] }>('/me/player/devices');
    return response.devices;
  }

  /**
   * Transfer playback to a specific device
   */
  async transferPlayback(deviceId: string, play = false): Promise<void> {
    await this.request('/me/player', {
      method: 'PUT',
      body: JSON.stringify({
        device_ids: [deviceId],
        play,
      }),
    });
  }

  /**
   * Get the currently active device, or the first available device if none is active
   */
  async getActiveOrAvailableDevice(): Promise<{ id: string; name: string; type: string } | null> {
    const devices = await this.getDevices();

    if (devices.length === 0) {
      return null;
    }

    // Find active device
    const activeDevice = devices.find(d => d.is_active);
    if (activeDevice) {
      return activeDevice;
    }

    // Return first available device if no active device
    return devices[0];
  }

  /**
   * Start or resume playback with smart device targeting
   * If no device is active, automatically picks the first available device
   */
  async playSmartly(): Promise<{ device?: { name: string; type: string } }> {
    try {
      // Try to play on current active device
      await this.play();

      // Get playback state to return device info
      const state = await this.getPlaybackState();
      return { device: state?.device };
    } catch (error) {
      // If play fails (likely 404 - no active device), try to activate a device
      if (error instanceof SpotifyAPIError && error.status === 404) {
        const device = await this.getActiveOrAvailableDevice();

        if (!device) {
          throw new SpotifyAPIError('No Spotify devices available', 404, null);
        }

        // Transfer playback to the device and start playing
        await this.transferPlayback(device.id, true);
        return { device: { name: device.name, type: device.type } };
      }
      throw error;
    }
  }
}
