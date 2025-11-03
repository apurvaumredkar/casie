# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT: Documentation Security

**When writing or updating README files:**
- **NEVER include user-specific information** - This is a public repository for reference
- **ALWAYS use placeholders** for:
  - API tokens, secrets, and credentials
  - Account IDs and namespace IDs
  - Personal file paths and directory structures
  - User-specific configuration values
- Replace with generic examples like `YOUR_API_TOKEN`, `your_cloudflare_account_id`, `C:\path\to\your\files`
- Include instructions for generating secure values rather than showing actual values

This repository is published publicly as a reference for others to learn from and build upon.

## Project Overview

**CASIE** (Context-Aware Small Intelligence on Edge) is a Discord bot platform built as **two independent Cloudflare Workers** with an optional **local bridge server**. The project demonstrates modular bot architecture where each component serves specialized capabilities:

1. **Core Bot** ([casie-core/](casie-core/)) - AI chat, web search, weather updates, and local file access
2. **Spotify Bot** ([casie-spotify/](casie-spotify/)) - Spotify integration with natural language control
3. **CASIE Bridge** ([casie-bridge/](casie-bridge/)) - Local FastAPI server for accessing local files via Cloudflare Tunnel

The workers run on Cloudflare's edge network and use TypeScript with strict type checking. The bridge runs locally on Windows with Python/FastAPI.

## Architecture

### Three-Component Architecture

```
CASIE Platform
├── casie-core/                 # Core Bot Worker
│   ├── /ask                    # Direct LLM chat
│   ├── /web-search             # Web search + AI summarization
│   ├── /weather [location]     # Weather info (defaults to Buffalo NY)
│   ├── /videos <query>         # **NEW** Unified command: browse library OR open episodes
│   ├── /files <query>          # [DEPRECATED] Query local media library (use /videos instead)
│   ├── /location               # Get current location (via CASIE Bridge)
│   ├── /open <query>           # [DEPRECATED] Open episode (use /videos instead)
│   ├── /lock-pc                # Lock Windows PC with confirmation (requires CASIE Bridge)
│   ├── /clear                  # Bulk delete channel messages
│   └── /cron/weather           # Scheduled weather updates (GitHub Actions)
│
├── casie-spotify/              # Spotify Bot Worker
│   ├── /linkspotify            # OAuth 2.0 authorization flow
│   ├── /play <query>           # Search and play with confirmation
│   ├── /resume                 # Resume/start playback
│   ├── /pause                  # Pause playback
│   ├── /next                   # Skip to next track
│   ├── /previous               # Go to previous track
│   ├── /nowplaying             # Show current track with artwork
│   ├── /playlists              # List user-created playlists
│   └── /spotify <query>        # Natural language Spotify control
│
└── casie-bridge/               # Local Bridge Server
    ├── GET /                   # Health check
    ├── GET /health             # Detailed health check
    ├── GET /videos             # TV show library index (markdown)
    ├── GET /location           # Cached location data (IP geolocation)
    ├── POST /open              # Open local file with Windows default app
    └── POST /lock              # Lock Windows PC (Win+L)
```

**Why separate workers?**
- Isolated deployments and secrets
- Independent scaling and error handling
- Modular feature development
- Each bot is its own Discord application

### Core Bot (casie-core)

**Entry Point**: [casie-core/src/worker.ts](casie-core/src/worker.ts)

**Handler Pattern**: Standard Cloudflare Worker with `(request, env, ctx)` parameters
  - `request`: The incoming HTTP request (Discord webhook interactions)
  - `env`: Environment bindings (secrets and AI binding)
  - `ctx`: Execution context for async operations like `ctx.waitUntil()`

**Commands**:

1. **`/ask <query>`** - Direct LLM chat
   - User input → Cloudflare AI (primary) / OpenRouter (fallback) → Response
   - Uses deferred response pattern to avoid Discord's 3-second timeout
   - Model: `@cf/meta/llama-3.2-3b-instruct` (Cloudflare AI), `meta-llama/llama-4-scout:free` (OpenRouter)

2. **`/web-search <query>`** - Web search with AI summarization
   - User query → Brave Search API → Cloudflare AI (primary) / OpenRouter (fallback) → Response
   - Intelligent result filtering (returns top 5 most relevant results)
   - Uses deferred response pattern

3. **`/weather [location]`** - Weather information
   - Optional location parameter (defaults to Buffalo NY)
   - Uses wttr.in API (no API key required)
   - Returns AI-summarized weather with contextual advice
   - Examples: `/weather Tokyo`, `/weather` (defaults to Buffalo)

4. **`/videos <query>`** - **UNIFIED** TV library browsing and playback
   - **NEW**: Combines functionality of `/files` and `/open` into one intelligent command
   - Uses LLM with full library context to determine user intent
   - **Browse Mode**: Query, search, and list your TV show library
   - **Open Mode**: Parse episode references and open videos
   - Architecture: Fetch videos.md → LLM classification → Route to browse OR open
   - Examples:
     - Browse: `/videos what shows do you have?`
     - Browse: `/videos search for friends`
     - Browse: `/videos how many episodes of brooklyn nine nine?`
     - Open: `/videos open brooklyn nine nine s01e01`
     - Open: `/videos play friends season 2 episode 5`
     - Hybrid: `/videos friends` → LLM suggests available episodes

5. **`/files <query>`** - [DEPRECATED] Query local media library
   - Use `/videos` instead for unified experience
   - Still functional for backward compatibility
   - Returns AI-summarized information about TV shows
   - Examples: `/files list all shows`, `/files search for friends`

6. **`/open <query>`** - [DEPRECATED] Open specific episode
   - Use `/videos` instead for unified experience
   - Still functional for backward compatibility
   - Parses query → D1 lookup → Opens file
   - Examples: `/open brooklyn nine nine season 1 episode 1`

7. **`/clear`** - Bulk delete channel messages
   - Requires "Manage Messages" permission
   - Deletes up to 100 messages less than 14 days old (Discord limitation)
   - Completely silent operation (no confirmation message)

**CRON Endpoint**:
- **GET /cron/weather** - Scheduled weather updates
  - Triggered by GitHub Actions workflow ([.github/workflows/weather-cron.yml](.github/workflows/weather-cron.yml))
  - Runs weekdays at 7 AM Eastern (11 AM UTC)
  - Requires `Authorization: Bearer <CRON_SECRET_TOKEN>` header
  - Sends weather update to configured Discord channel
  - Returns JSON status with location info

**LLM Fallback Strategy**:
- **Primary**: Cloudflare AI (`@cf/meta/llama-3.2-3b-instruct`)
  - Free tier: 10,000 neurons/day
  - Lower latency (runs on same edge network)
  - Automatically falls back on error or empty response
- **Fallback**: OpenRouter (`meta-llama/llama-4-scout:free`)
  - Free tier available
  - More reliable but slightly higher latency
  - Used when Cloudflare AI fails or returns empty

### Spotify Bot (casie-spotify)

**Entry Point**: [casie-spotify/src/index.ts](casie-spotify/src/index.ts)

**Modular Architecture**:
```
casie-spotify/src/
├── commands/          # Individual command handlers
│   ├── link.ts       # OAuth linking
│   ├── play.ts       # Resume/start playback
│   ├── pause.ts      # Pause playback
│   ├── next.ts       # Next track
│   ├── previous.ts   # Previous track
│   ├── nowplaying.ts # Current track info
│   ├── playlists.ts  # List playlists
│   └── search.ts     # Search and play
├── llm/              # Natural language processing
│   ├── agent.ts      # Agentic loop with retry logic
│   └── interpreter.ts # Intent parsing and entity extraction
├── spotify/          # Spotify API integration
│   ├── client.ts     # Spotify API client wrapper
│   └── oauth.ts      # OAuth 2.0 flow and token management
└── utils/            # Helper utilities
    ├── discord.ts    # Discord interaction utilities
    ├── storage.ts    # KV storage for tokens
    └── ratelimit.ts  # Per-user rate limiting
```

**Key Technologies**:
- **Cloudflare KV**: Persistent token storage (survives worker restarts)
- **HMAC-signed OAuth**: Stateless OAuth state management (no session storage)
- **Smart Device Targeting**: Auto-activates available Spotify devices
- **LLM Intent Parsing**: Natural language Spotify control via Cloudflare AI (primary) / OpenRouter (fallback)
- **Agentic Loop**: Retry logic for complex queries (up to 3 attempts)

**Natural Language Support**:
The `/spotify` command uses LLM to parse user intent and entities:
- **Intents**: play, pause, skip, search, discover
- **Entities**: track names, artists, albums, genres, playlists
- **Examples**:
  - "play some jazz" → searches for jazz
  - "skip to next song" → calls next command
  - "play paper rings by taylor swift" → searches for specific track

**Rate Limiting**:
- Per-user cooldowns to prevent abuse
- 5-second cooldown between `/spotify` commands
- Friendly error messages with remaining time

### Deferred Response Pattern

**Critical**: Discord requires responses within 3 seconds. Both workers use:
- Immediate acknowledgment with `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (type 5)
- Background processing with `ctx.waitUntil()`
- Follow-up message sent via Discord's webhook API after processing completes

This pattern is implemented in:
- **Core Bot**:
  - `handleAskDeferred()` - Processes `/ask` command asynchronously
  - `handleSearchDeferred()` - Processes `/web-search` command asynchronously
  - `handleWeatherDeferred()` - Processes `/weather` command asynchronously
  - `handleVideosDeferred()` - Processes unified `/videos` command asynchronously
  - `sendFollowup()` - Sends the actual response via webhook
- **Spotify Bot**:
  - `handleSpotifyNL()` - Processes `/spotify` command asynchronously
  - `editOriginalMessage()` - Updates the deferred response

### Unified Videos Command Architecture

**Problem**: Previously had two separate commands with different use cases:
- `/files` - Browse library (read-only, conversational)
- `/open` - Open specific episode (action-based, structured parsing)

**Solution**: Single `/videos` command that intelligently routes based on user intent using LLM.

**Flow**:
```
User: "/videos search for friends"
    ↓
1. Fetch videos.md from CASIE Bridge (library index)
2. Call unified LLM with full library context
    System Prompt: "You are a library assistant with playback capabilities"
    Context: Full videos.md content embedded
    Response Format: JSON with mode + data
3. LLM classifies intent and responds:
    {"mode": "browse", "response": "**Friends** is in your library..."}
    OR
    {"mode": "open", "action": {"series": "Friends", "season": 1, "episode": 1}}
4. Route based on mode:
    - Browse → Send LLM response directly
    - Open → Query D1 → Call Bridge /open → Confirm
```

**Key Design Decisions**:
- **Single LLM call** (not separate intent classifier) - lower latency
- **Full library context** - enables intelligent suggestions and validation
- **Temperature: 0.2** - balanced for both classification and conversation
- **Max tokens: 600** - enough for browse responses + JSON structure
- **Backward compatibility** - `/files` and `/open` still work (deprecated)

**Benefits**:
- Natural user experience (no need to know which command to use)
- Contextual suggestions (LLM sees what's actually available)
- Fewer commands to remember
- Extensible (easy to add new modes like "queue", "recommend", etc.)

### Security

**Core Bot**:
- **Discord Signature Verification**: All requests verify Ed25519 signatures using `verifyDiscordRequest()`
- **CRON Authentication**: Bearer token validation for scheduled weather updates
- **API Keys**: Stored as Cloudflare Worker secrets (not in code)

**Spotify Bot**:
- **Discord Signature Verification**: Ed25519 signatures for all Discord interactions
- **OAuth 2.0**: Secure Spotify account linking with PKCE
- **HMAC-signed State**: Stateless OAuth state management (CSRF protection)
- **Token Security**: Encrypted storage in Cloudflare KV
- **Rate Limiting**: Per-user cooldowns to prevent abuse

### Configuration & Secrets

**Core Bot** ([casie-core/wrangler.toml](casie-core/wrangler.toml)):
- Entry point: `src/worker.ts`
- Required secrets:
  - `DISCORD_PUBLIC_KEY` - Discord app public key for signature verification
  - `DISCORD_BOT_TOKEN` - Discord bot token for API calls
  - `OPENROUTER_API_KEY` - OpenRouter API key for LLM fallback
  - `BRAVE_API_KEY` - Brave Search API key for web search
  - `CRON_SECRET_TOKEN` - Secret token for CRON endpoint authentication
  - `WEATHER_CHANNEL_ID` - Discord channel ID for scheduled weather updates
  - `CASIE_BRIDGE_API_TOKEN` - Bearer token for CASIE Bridge authentication
- Bindings:
  - `AI` - Cloudflare AI binding (for LLM)
  - `DB` - Cloudflare D1 database (for episode lookup)
  - `CASIE_BRIDGE_KV` - KV namespace for bridge tunnel URL storage

**Spotify Bot** ([casie-spotify/wrangler.toml](casie-spotify/wrangler.toml)):
- Entry point: `src/index.ts`
- Required secrets:
  - `DISCORD_PUBLIC_KEY` - Discord app public key
  - `DISCORD_BOT_TOKEN` - Discord bot token
  - `SPOTIFY_CLIENT_ID` - Spotify app client ID
  - `SPOTIFY_CLIENT_SECRET` - Spotify app client secret
  - `SPOTIFY_REDIRECT_URI` - OAuth redirect URI
  - `OPENROUTER_API_KEY` - OpenRouter API key for LLM
- Bindings:
  - `SPOTIFY_TOKENS` - Cloudflare KV namespace for token storage
  - `AI` - Cloudflare AI binding (for natural language parsing)
- Environment variables:
  - `OPENROUTER_MODEL` - Override default model (optional)

## Development Commands

### Running the Workers

**Core Bot**:
```bash
cd casie-core
npm run dev        # Start local development server on http://localhost:8787
npm start          # Alias for npm run dev
```

**Spotify Bot**:
```bash
cd casie-spotify
npm run dev        # Start local development server on http://localhost:8787
```

### Testing

**Core Bot**:
```bash
cd casie-core
npm test           # Run all tests with Vitest
```

The test suite uses `@cloudflare/vitest-pool-workers` which provides:
- **Unit-style tests**: Import the worker and call `worker.fetch()` directly with mocked `env` and `ctx`
- **Integration-style tests**: Use the `SELF` binding to make actual HTTP requests to the worker

Test utilities from `cloudflare:test`:
- `env`: Mock environment object
- `createExecutionContext()`: Create execution context for unit tests
- `waitOnExecutionContext(ctx)`: Wait for all promises passed to `ctx.waitUntil()` to settle
- `SELF`: Integration test binding to make real requests

**Spotify Bot**:
```bash
cd casie-spotify
npm test           # Currently not implemented
npm run build      # Type-check with TypeScript (no output files)
```

### Deployment

**Core Bot**:
```bash
cd casie-core
npm run deploy     # Deploy to Cloudflare Workers
```

**Spotify Bot**:
```bash
cd casie-spotify
npm run deploy     # Deploy to Cloudflare Workers
```

### Type Generation

After modifying `wrangler.toml`, regenerate type definitions:

```bash
# Core Bot
cd casie-core
npm run cf-typegen # Regenerates worker-configuration.d.ts

# Spotify Bot
cd casie-spotify
npm run cf-typegen # Regenerates worker-configuration.d.ts
```

### Managing Secrets

**Core Bot**:
```bash
cd casie-core

# Set individual secrets
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put OPENROUTER_API_KEY
wrangler secret put BRAVE_API_KEY
wrangler secret put CRON_SECRET_TOKEN
wrangler secret put WEATHER_CHANNEL_ID

# List all secrets
wrangler secret list

# Delete a secret
wrangler secret delete WEATHER_API_KEY  # Example: removing old weather API key
```

**Spotify Bot**:
```bash
cd casie-spotify

# Set individual secrets
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put SPOTIFY_CLIENT_ID
wrangler secret put SPOTIFY_CLIENT_SECRET
wrangler secret put SPOTIFY_REDIRECT_URI
wrangler secret put OPENROUTER_API_KEY

# Bulk upload from .env file
wrangler secret bulk .env

# List all secrets
wrangler secret list
```

**IMPORTANT**: For CRON to work, the `CRON_SECRET_TOKEN` in Cloudflare Worker must match `WEATHER_CRON_SECRET` in GitHub repository secrets:
```bash
# Generate a secure token
openssl rand -base64 32

# Set in Cloudflare (casie-core)
wrangler secret put CRON_SECRET_TOKEN

# Set in GitHub
gh secret set WEATHER_CRON_SECRET
```

## Key Patterns

### Discord Interaction Flow
1. Discord sends POST request with interaction payload
2. Worker verifies Ed25519 signature (security)
3. Worker immediately responds with deferred message (type 5)
4. Background processing via `ctx.waitUntil()`:
   - Call external APIs (Brave/OpenRouter/Spotify)
   - Send follow-up message via Discord webhook
5. Discord displays the follow-up as the bot's response

### Adding New Commands

**Core Bot**:
To add a new Discord slash command:
1. Register the command in Discord Developer Portal
2. Add case in the switch statement in [casie-core/src/worker.ts](casie-core/src/worker.ts) (around line 137-175)
3. Create a deferred handler function (e.g., `handleNewCommandDeferred`)
4. Use `ctx.waitUntil()` to process asynchronously
5. Call `sendFollowup()` to send the response

**Example**: See `handleVideosDeferred()` for a unified command that intelligently routes between multiple behaviors based on LLM classification.

**Spotify Bot**:
To add a new Spotify command:
1. Register the command in Discord Developer Portal
2. Create new handler in `src/commands/` directory
3. Export handler function that returns Discord response
4. Add case in switch statement in [casie-spotify/src/index.ts:109-142](casie-spotify/src/index.ts#L109-L142)
5. Use `deferredResponse()` for long-running operations

### External API Integration

**Brave Search** (Core Bot):
- Returns top 5 web results after intelligent filtering
- Filtering algorithm:
  - Exact phrase matches (highest priority)
  - Individual term matches
  - Authority domain boosting (wikipedia, .gov, .edu)
  - Relevance scoring
- No authentication required beyond API key

**wttr.in Weather API** (Core Bot):
- Free, open-source weather service
- **No API key required** (major advantage)
- JSON format: `https://wttr.in/{location}?format=j1`
- Response structure:
  - `current_condition[0]` - Current weather data
  - `nearest_area[0]` - Location information
  - `weather[0].astronomy[0]` - Sunrise/sunset/moon data
- Auto-location detection when no location specified
- Comprehensive data: temp, feels-like, humidity, wind, precipitation, cloud cover, sunrise/sunset

**OpenRouter LLM** (Both bots):
- Free tier available with `meta-llama/llama-4-scout:free`
- Used as fallback when Cloudflare AI fails
- Configuration:
  - Temperature: 0.4
  - Max tokens: 800 for `/ask`, 600 for `/web-search`, 500 for weather
- Always handle API errors gracefully with try-catch and user-friendly messages

**Spotify API** (Spotify Bot):
- OAuth 2.0 flow with PKCE
- Token refresh handled automatically
- Rate limiting: Spotify API has its own rate limits
- Client wrapper in [casie-spotify/src/spotify/client.ts](casie-spotify/src/spotify/client.ts)

### TypeScript Configuration

**Core Bot**:
- Strict mode enabled
- Module resolution: "Bundler"
- Target: ES2020
- Tests in separate `test/` directory

**Spotify Bot**:
- Strict mode enabled
- Module resolution: "Bundler"
- Target: ES2020
- No separate test configuration yet

### Important Notes

**Core Bot**:
- Never respond synchronously to long-running operations (>3 seconds)
- Always use deferred responses for API calls
- Discord webhook tokens are single-use and expire after 15 minutes
- Weather data hardcoded to Buffalo NY for scheduled updates (edge network location detection unreliable)
- CRON endpoint must validate Bearer token before processing

**Spotify Bot**:
- Always check if user is linked before making Spotify API calls
- Refresh tokens automatically if expired
- Handle device unavailability gracefully with clear error messages
- Rate limit natural language queries to prevent abuse
- Interactive components (buttons) require component_id handling

### Common Issues & Solutions

**CRON Job Failures**:
- Ensure `CRON_SECRET_TOKEN` (Cloudflare) matches `WEATHER_CRON_SECRET` (GitHub)
- Check GitHub Actions logs: `gh run list --workflow=weather-cron.yml`
- Test endpoint manually: `curl https://casie-core.apoorv-umredkar.workers.dev/cron/weather -H "Authorization: Bearer YOUR_TOKEN"`

**Cloudflare AI Failures**:
- Worker automatically falls back to OpenRouter
- Check OpenRouter API key is valid
- Monitor usage: Cloudflare AI has 10k neurons/day free tier

**Spotify Token Issues**:
- Tokens stored in KV expire after 1 hour
- Worker handles refresh automatically
- If refresh fails, user must relink with `/linkspotify`

**Discord 3-Second Timeout**:
- Always use deferred responses for operations that might take >3 seconds
- Never make synchronous API calls in command handlers
- Use `ctx.waitUntil()` for background processing

## Project Structure

```
casie/
├── casie-core/                    # Core Bot Worker
│   ├── src/
│   │   ├── worker.ts             # Main entry point
│   │   └── index.ts              # Re-exports worker
│   ├── test/
│   │   └── index.spec.ts         # Vitest tests
│   ├── wrangler.toml             # Worker configuration
│   ├── package.json              # Dependencies and scripts
│   └── worker-configuration.d.ts # Auto-generated types
│
├── casie-spotify/                 # Spotify Bot Worker
│   ├── src/
│   │   ├── index.ts              # Main entry point
│   │   ├── commands/             # Command handlers
│   │   ├── llm/                  # Natural language processing
│   │   ├── spotify/              # Spotify API integration
│   │   └── utils/                # Helper utilities
│   ├── wrangler.toml             # Worker configuration
│   ├── package.json              # Dependencies and scripts
│   └── worker-configuration.d.ts # Auto-generated types
│
├── .github/
│   └── workflows/
│       └── weather-cron.yml      # Scheduled weather updates
│
└── CLAUDE.md                      # This file
```

### CASIE Bridge (casie-bridge)

**Entry Point**: [casie-bridge/main.py](casie-bridge/main.py)

**Purpose**: Local FastAPI server that bridges Discord bot commands to local Windows resources via Cloudflare Tunnel.

**Architecture**:
- **FastAPI Server**: Runs on `http://127.0.0.1:8000`
- **Cloudflare Tunnel**: Exposes local server with free HTTPS URL
- **Bearer Token Auth**: All endpoints require `Authorization: Bearer <token>` header
- **KV URL Storage**: Tunnel URL automatically uploaded to Cloudflare KV
- **Auto-start**: Configured via Windows Task Scheduler to start on login

**Endpoints**:

1. **`GET /`** - Health check endpoint
   - Returns: `{"ok": true, "service": "CASIE Bridge"}`
   - Requires authentication

2. **`GET /health`** - Detailed health check
   - Returns service status, version, and authentication status
   - Requires authentication

3. **`GET /videos`** - TV show library index
   - Returns markdown content of TV shows from `videos.md`
   - Generated by `videos.py` script
   - Requires authentication
   - Used by `/files` Discord command

4. **`GET /location`** - Cached location data
   - Fetches geolocation from ip-api.com
   - 3-hour cache TTL (stored in `location.json`)
   - Auto-refreshes when expired
   - Returns: country, region, city, timezone, coordinates
   - Used by `/location` Discord command

5. **`POST /open`** - Open local file
   - Request body: `{"path": "C:\\path\\to\\file.txt"}`
   - Opens file with Windows default application
   - Uses Windows `start` command
   - Used by `/open` Discord command

**Directory Structure**:
```
casie-bridge/
├── main.py                 # FastAPI application
├── videos.py               # Unified TV show management (markdown + D1)
├── videos.md               # Generated TV shows index (gitignored)
├── location.json           # Cached location data (gitignored)
├── requirements.txt        # Python dependencies
├── .env                    # Environment config (contains secrets)
├── casie.ps1               # Main service control script
├── setup_autostart.ps1     # Configure Task Scheduler
├── setup_api_token.ps1     # Generate and configure API token
└── tunnel.log              # Cloudflare tunnel output
```

**PowerShell Management Scripts**:
- `casie.ps1` - Unified service manager for FastAPI and Cloudflare Tunnel
  - Usage: `casie.ps1 -Action [start|stop|restart|status] [-Service all|api|tunnel]`
  - Examples: `casie.ps1 -Action start`, `casie.ps1 -Action stop -Service api`
- `setup_autostart.ps1` - Configures Windows Task Scheduler for auto-start
- `setup_api_token.ps1` - Generates secure API token and updates .env file

**TV Show Indexing & D1 Database**:
The `videos.py` script is a unified tool that handles both markdown generation and Cloudflare D1 database population:

```bash
# Default usage (both operations)
python videos.py

# Generate markdown only
python videos.py --markdown-only

# Populate D1 database only
python videos.py --d1-only
```

**Environment Configuration** (`.env` file):
```bash
TV_DIRECTORY=C:\path\to\your\TV    # Path to TV shows directory
D1_DATABASE_ID=your-database-id    # Cloudflare D1 database ID
```

The script performs two operations:

1. **Markdown Generation** (`videos.md`):
   - Scans local TV directory
   - Lists all TV shows with season/episode counts
   - Alphabetically sorted
   - Used by `/files` Discord command via CASIE Bridge `/videos` endpoint

2. **D1 Database Population**:
   - Scans all video files (S##E## format)
   - Extracts series, season, episode, and filepath
   - Clears existing D1 data
   - Batch inserts to Cloudflare D1 (100 episodes per batch)
   - Uses temporary SQL files to avoid command-line length limits
   - Verifies insertion count after completion

**D1 Database Schema**:
```sql
CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series TEXT NOT NULL,
  season INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  filepath TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Fast lookups by series, season, episode
CREATE INDEX idx_episodes_lookup ON episodes(series, season, episode);

-- Fuzzy series name matching (case-insensitive)
CREATE INDEX idx_episodes_series ON episodes(series COLLATE NOCASE);
```

**How `/open` Command Works**:
1. User sends query: "brooklyn nine nine season 1 episode 1"
2. **LLM Parsing** (Cloudflare AI): Extracts structured data → `{series: "Brooklyn Nine-Nine", season: 1, episode: 1}`
3. **D1 Lookup**: SQL query with `LIKE` for fuzzy series matching → returns filepath
4. **CASIE Bridge**: Receives filepath, opens file with Windows default app
5. **Response**: Confirms file opened successfully

**Migration from Qdrant**:
- Previously used vector embeddings + semantic search
- Now uses LLM parsing + exact SQL lookups
- **Benefits**: Faster (28ms vs 60ms+), more accurate, simpler architecture, lower cost

**Authentication**:
All endpoints require Bearer token in `Authorization` header:
```bash
curl -H "Authorization: Bearer <token>" <tunnel-url>/videos
```

Token is stored in `.env` file as `API_AUTH_TOKEN`.

**Cloudflare Tunnel URL Management**:
The tunnel URL changes on each restart. `start_tunnel.ps1` automatically:
1. Starts cloudflared tunnel
2. Extracts the dynamic URL from tunnel output
3. Uploads URL to Cloudflare KV namespace
4. Core Bot worker reads URL from KV to communicate with bridge

**Integration with Core Bot**:
Core Bot accesses CASIE Bridge via KV:
```typescript
// Get tunnel URL from KV
const tunnelUrl = await env.CASIE_BRIDGE_KV.get('current_tunnel_url');

// Make authenticated request
const response = await fetch(`${tunnelUrl}/videos`, {
  headers: {
    'Authorization': `Bearer ${env.CASIE_BRIDGE_API_TOKEN}`
  }
});
```

6. **`POST /lock`** - Lock Windows PC
   - Locks the workstation using `rundll32.exe user32.dll,LockWorkStation`
   - Programmatic equivalent of pressing Win+L
   - No request body required
   - Returns: `{"ok": true, "message": "PC locked successfully"}`
   - Used by `/lock-pc` Discord command
   - Requires authentication

**Discord Command: `/lock-pc`**
   - Requires CASIE Bridge to be running
   - Shows interactive confirmation dialog with Yes/No buttons
   - Access restricted to authorized Discord user ID (set in env)
   - Red "Yes, Lock PC" button for confirmation
   - Gray "Cancel" button to abort
   - Immediate response with no deferral for button display

