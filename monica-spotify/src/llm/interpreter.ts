/**
 * LLM Intent Interpreter
 *
 * Uses OpenRouter (meta-llama/llama-4-scout:free) to interpret natural language
 * music requests and convert them to structured intents for Spotify API execution.
 */

export interface Intent {
  intent: 'play' | 'pause' | 'next' | 'previous' | 'search' | 'create_playlist' | 'add_to_playlist' | 'list_playlist_tracks' | 'list_artist_albums' | 'list_album_tracks' | 'unknown';
  // Extracted entities (null if not specified)
  track?: string | null; // Specific track/song name
  artist?: string | null; // Artist name
  album?: string | null; // Album name
  playlist?: string | null; // Playlist name
  genre?: string | null; // Music genre
  query?: string | null; // Ambiguous/general query (e.g., "something upbeat")
  // Legacy field for backward compatibility
  target?: string;
  playlist_name?: string;
}

export interface OpenRouterEnv {
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL?: string;
}

const SYSTEM_PROMPT = `
<spotify_intent_parser>
    <role>Extract structured music data from natural language</role>
    <task>Parse user queries and identify intent plus relevant music entities</task>

    <output_schema>
        {
            "intent": "play | pause | next | previous | search | create_playlist | add_to_playlist | list_playlist_tracks | list_artist_albums | list_album_tracks",
            "track": "string | null",
            "artist": "string | null",
            "album": "string | null",
            "playlist": "string | null",
            "genre": "string | null",
            "query": "string | null"
        }
    </output_schema>

    <entity_definitions>
        <entity name="intent" required="true">
            Action to perform:
            - play: Resume or start playback
            - pause: Pause playback
            - next: Skip forward
            - previous: Skip backward
            - search: Find and play specific music
            - create_playlist: Make new playlist
            - add_to_playlist: Add to existing playlist
            - list_playlist_tracks: Show songs in a playlist
            - list_artist_albums: Show all albums by an artist
            - list_album_tracks: Show tracks in an album
        </entity>
        <entity name="track">Song or track name (set to null if not specified)</entity>
        <entity name="artist">Artist or band name (set to null if not specified)</entity>
        <entity name="album">Album name (set to null if not specified)</entity>
        <entity name="playlist">Playlist name (set to null if not specified)</entity>
        <entity name="genre">Music genre (set to null if not specified)</entity>
        <entity name="query">Ambiguous request that needs search (set to null if entities are clear)</entity>
    </entity_definitions>

    <examples>
        <example>
            <input>play paper rings by taylor swift</input>
            <output>{"intent":"search","track":"paper rings","artist":"taylor swift","album":null,"playlist":null,"genre":null,"query":null}</output>
        </example>
        <example>
            <input>play some jazz</input>
            <output>{"intent":"search","track":null,"artist":null,"album":null,"playlist":null,"genre":"jazz","query":null}</output>
        </example>
        <example>
            <input>pause</input>
            <output>{"intent":"pause","track":null,"artist":null,"album":null,"playlist":null,"genre":null,"query":null}</output>
        </example>
        <example>
            <input>next song</input>
            <output>{"intent":"next","track":null,"artist":null,"album":null,"playlist":null,"genre":null,"query":null}</output>
        </example>
        <example>
            <input>play bohemian rhapsody</input>
            <output>{"intent":"search","track":"bohemian rhapsody","artist":null,"album":null,"playlist":null,"genre":null,"query":null}</output>
        </example>
        <example>
            <input>play the beatles abbey road</input>
            <output>{"intent":"search","track":null,"artist":"the beatles","album":"abbey road","playlist":null,"genre":null,"query":null}</output>
        </example>
        <example>
            <input>play my discover weekly</input>
            <output>{"intent":"search","track":null,"artist":null,"album":null,"playlist":"discover weekly","genre":null,"query":null}</output>
        </example>
        <example>
            <input>play something upbeat</input>
            <output>{"intent":"search","track":null,"artist":null,"album":null,"playlist":null,"genre":null,"query":"upbeat music"}</output>
        </example>
        <example>
            <input>create playlist called chill vibes</input>
            <output>{"intent":"create_playlist","track":null,"artist":null,"album":null,"playlist":"chill vibes","genre":null,"query":null}</output>
        </example>
        <example>
            <input>list songs in my discover weekly</input>
            <output>{"intent":"list_playlist_tracks","track":null,"artist":null,"album":null,"playlist":"discover weekly","genre":null,"query":null}</output>
        </example>
        <example>
            <input>show me all taylor swift albums</input>
            <output>{"intent":"list_artist_albums","track":null,"artist":"taylor swift","album":null,"playlist":null,"genre":null,"query":null}</output>
        </example>
        <example>
            <input>what songs are in abbey road</input>
            <output>{"intent":"list_album_tracks","track":null,"artist":null,"album":"abbey road","playlist":null,"genre":null,"query":null}</output>
        </example>
    </examples>

    <rules>
        - Output ONLY valid JSON, no other text
        - Set unused fields to null (not undefined, not omitted)
        - Extract all recognizable entities from input
        - Use "search" intent when user wants to play specific content
        - Use "query" field only for vague/ambiguous requests
        - Be precise with entity extraction (track vs artist vs album)
    </rules>
</spotify_intent_parser>
`;

/**
 * Call OpenRouter API to interpret user query
 */
async function callOpenRouter(
  query: string,
  env: OpenRouterEnv
): Promise<string> {
  const model = env.OPENROUTER_MODEL || 'meta-llama/llama-4-scout:free';

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/spotibot', // Optional but recommended
      'X-Title': 'SpotiBot', // Optional but recommended
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      temperature: 0.3, // Lower temperature for more consistent JSON output
      max_tokens: 200,
      // Note: response_format not supported by Meta Llama models
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data: any = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from OpenRouter');
  }

  return data.choices[0].message.content;
}

/**
 * Parse LLM response into structured intent
 */
function parseIntent(llmResponse: string): Intent {
  try {
    // Remove potential markdown code blocks
    let cleanResponse = llmResponse.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(cleanResponse);

    // Validate intent type
    const validIntents = ['play', 'pause', 'next', 'previous', 'search', 'create_playlist', 'add_to_playlist', 'list_playlist_tracks', 'list_artist_albums', 'list_album_tracks'];
    if (!parsed.intent || !validIntents.includes(parsed.intent)) {
      console.error('Invalid intent:', parsed.intent);
      return { intent: 'unknown' };
    }

    // Build target from entities for backward compatibility
    let target: string | undefined = undefined;
    if (parsed.track || parsed.artist || parsed.album || parsed.genre || parsed.query) {
      const parts: string[] = [];
      if (parsed.track) parts.push(parsed.track);
      if (parsed.artist) parts.push(parsed.artist);
      if (parsed.album) parts.push(parsed.album);
      if (parsed.genre) parts.push(parsed.genre);
      if (parsed.query) parts.push(parsed.query);
      target = parts.join(' ');
    }

    return {
      intent: parsed.intent,
      track: parsed.track ?? null,
      artist: parsed.artist ?? null,
      album: parsed.album ?? null,
      playlist: parsed.playlist ?? null,
      genre: parsed.genre ?? null,
      query: parsed.query ?? null,
      // Legacy fields for backward compatibility
      target: target,
      playlist_name: parsed.playlist ?? undefined,
    };
  } catch (error) {
    console.error('Failed to parse LLM response:', error);
    console.error('Raw response:', llmResponse);
    return { intent: 'unknown' };
  }
}

/**
 * Main function: Interpret natural language query into structured intent
 * @param query - User's natural language music request
 * @param env - Environment with OpenRouter credentials
 * @returns Structured intent object
 */
export async function interpretQuery(
  query: string,
  env: OpenRouterEnv
): Promise<Intent> {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  if (!query || query.trim().length === 0) {
    return { intent: 'unknown' };
  }

  try {
    const llmResponse = await callOpenRouter(query, env);
    const intent = parseIntent(llmResponse);

    console.log('Query:', query);
    console.log('LLM Response:', llmResponse);
    console.log('Parsed Intent:', intent);

    return intent;
  } catch (error) {
    console.error('Error interpreting query:', error);
    return { intent: 'unknown' };
  }
}
