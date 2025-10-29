/**
 * LLM Intent Interpreter
 *
 * Uses OpenRouter (meta-llama/llama-4-scout:free) to interpret natural language
 * music requests and convert them to structured intents for Spotify API execution.
 */

export interface Intent {
  intent: 'play' | 'pause' | 'next' | 'previous' | 'search' | 'create_playlist' | 'add_to_playlist' | 'unknown';
  target?: string; // Track/artist/album name for search
  playlist_name?: string; // Playlist name for create/add operations
}

export interface OpenRouterEnv {
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL?: string;
}

const SYSTEM_PROMPT = `You are a command interpreter for Spotify. Convert the user's natural language music request into a structured JSON intent.

Respond STRICTLY in JSON format with the following structure:
{
  "intent": "<one of: play, pause, next, previous, search, create_playlist, add_to_playlist>",
  "target": "<track/artist/album name if searching or playing specific content>",
  "playlist_name": "<playlist name if creating or adding to playlist>"
}

Intent Guidelines:
- "play" - Resume playback or play specific content (include target if specific)
- "pause" - Pause current playback
- "next" - Skip to next track
- "previous" - Go to previous track
- "search" - Search for specific music (always include target)
- "create_playlist" - Create a new playlist (include playlist_name)
- "add_to_playlist" - Add track to playlist (include target and playlist_name)

Examples:
User: "play some jazz"
Response: {"intent": "search", "target": "jazz"}

User: "pause"
Response: {"intent": "pause"}

User: "next song"
Response: {"intent": "next"}

User: "play bohemian rhapsody"
Response: {"intent": "search", "target": "bohemian rhapsody"}

User: "create a playlist called summer vibes"
Response: {"intent": "create_playlist", "playlist_name": "summer vibes"}

User: "add this song to my workout playlist"
Response: {"intent": "add_to_playlist", "playlist_name": "workout"}

IMPORTANT: Only respond with valid JSON. No explanation, no markdown, just the JSON object.`;

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
      response_format: { type: 'json_object' }, // Request JSON mode if supported
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
    const validIntents = ['play', 'pause', 'next', 'previous', 'search', 'create_playlist', 'add_to_playlist'];
    if (!parsed.intent || !validIntents.includes(parsed.intent)) {
      return { intent: 'unknown' };
    }

    return {
      intent: parsed.intent,
      target: parsed.target || undefined,
      playlist_name: parsed.playlist_name || undefined,
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
