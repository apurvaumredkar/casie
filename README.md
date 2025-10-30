# Monica - AI Bot Suite on Cloudflare Workers

> A comprehensive educational project demonstrating serverless Discord bot development on Cloudflare Workers with TypeScript, showcasing modern patterns for OAuth, persistent storage, LLM integration, and stateless architecture.

Monica is a production-ready Discord bot suite built entirely on **Cloudflare Workers**, demonstrating how to run serverless Discord bots on the edge with zero infrastructure management. This project serves as a reference implementation for developers looking to build scalable, cost-effective Discord bots using modern serverless patterns.

---

## 🎯 What This Project Teaches

This repository demonstrates:

- **✅ Serverless Discord Bots** - Building bots without traditional servers or WebSocket connections
- **✅ Edge Computing** - Deploying globally distributed applications on Cloudflare's network
- **✅ OAuth 2.0 Flows** - Implementing stateless OAuth with HMAC-signed state management
- **✅ Persistent Storage** - Using Cloudflare KV for token management and user data
- **✅ LLM Integration** - Natural language processing with OpenRouter API
- **✅ API Integration** - Working with Spotify Web API, Brave Search, and Discord interactions
- **✅ TypeScript Patterns** - Type-safe development with proper interfaces and error handling
- **✅ Security** - Ed25519 signature verification, rate limiting, and secret management

**Perfect for developers learning:**
- Serverless architecture and edge computing
- Discord bot development with HTTP interactions
- OAuth 2.0 implementation patterns
- RESTful API integration
- TypeScript in production environments

---

## 🏗️ Architecture Overview

### Why Cloudflare Workers for Discord Bots?

Traditional Discord bots require:
- ❌ Always-on servers (VPS, EC2, etc.)
- ❌ WebSocket connections for real-time events
- ❌ Infrastructure management and scaling
- ❌ Deployment complexity

**Cloudflare Workers approach:**
- ✅ **Serverless** - No servers to manage or maintain
- ✅ **Edge computing** - Runs globally at 300+ locations
- ✅ **Interaction-based** - Uses Discord's HTTP interactions (slash commands)
- ✅ **Pay-per-use** - Free tier covers typical usage
- ✅ **Auto-scaling** - Handles traffic spikes automatically
- ✅ **Zero downtime** - Deploys without restarts or service interruptions
- ✅ **Low latency** - Responses from nearest edge location (<50ms typical)

### How Discord Interactions Work with Workers

```
┌──────────┐         ┌──────────────┐         ┌─────────────────┐
│  Discord │  HTTP   │  Cloudflare  │  Edge   │ External APIs   │
│  Server  │ ──────> │   Worker     │ ──────> │ (OpenRouter,    │
│          │ <────── │  (Handler)   │ <────── │  Spotify, etc.) │
└──────────┘         └──────────────┘         └─────────────────┘
     │                     │
     │  1. POST /          │
     │  (interaction)      │
     ├────────────────────>│
     │                     │
     │  2. Verify Ed25519  │
     │     signature       │
     │                     │
     │  3. Deferred resp   │
     │  (type 5)           │
     │<────────────────────┤
     │                     │
     │  4. Process async   │
     │     (ctx.waitUntil) │
     │                     │
     │  5. Follow-up msg   │
     │<────────────────────┤
```

**Key Components:**
1. **HTTP Endpoint**: Worker receives POST requests from Discord
2. **Signature Verification**: Ed25519 signature validation (required by Discord for security)
3. **Deferred Responses**: Immediate ACK (type 5) to avoid Discord's 3-second timeout
4. **Background Processing**: `ctx.waitUntil()` for async operations like API calls
5. **Follow-up Messages**: Edit original response via Discord webhook API

---

## 🤖 Bot Suite Structure

```
Monica Platform
├── core-bot (monica-core)
│   ├── AI chat with OpenRouter LLM
│   ├── Web search with Brave API + AI summarization
│   └── Stateless architecture (no storage required)
│
└── spotify-bot (monica-spotify)
    ├── Spotify OAuth 2.0 integration (stateless HMAC flow)
    ├── Natural language control via LLM
    ├── Direct playback commands (play, pause, next, etc.)
    ├── Interactive search with button components
    ├── Playlist management and discovery
    └── Cloudflare KV persistent token storage
```

### 1. Core Bot (monica-core)

**Purpose**: AI assistant for conversations and web search with summarization

**Commands**:
- `/ask <query>` - Chat with AI assistant (powered by LLaMA)
- `/web-search <query>` - Search the web with AI-powered summarization

**Technologies**:
- **Cloudflare Worker** - HTTP interaction handler
- **OpenRouter API** - LLM access (meta-llama/llama-4-scout:free)
- **Brave Search API** - Web search functionality
- **Deferred Response Pattern** - Handles long LLM processing times

**Key Features**:
- Stateless design (no persistent storage needed)
- Summarizes top 5 search results with LLM context
- 2-minute timeout protection with `ctx.waitUntil()`
- Ephemeral responses (private to user)

**Worker URL**: `https://monica-core.<your-subdomain>.workers.dev`

---

### 2. Spotify Bot (monica-spotify)

**Purpose**: Full Spotify control with natural language understanding and direct commands

**Commands**:
- `/linkspotify` - OAuth 2.0 flow to link Spotify account
- `/spotify <query>` - Natural language control (e.g., "play some jazz", "pause", "skip")
- `/play <query>` - Search Spotify and play tracks with interactive buttons
- `/resume` - Resume or start playback
- `/pause` - Pause current playback
- `/next` - Skip to next track
- `/previous` - Go to previous track
- `/nowplaying` - Display currently playing track with progress
- `/playlists` - View user-created playlists (filters followed playlists)

**Technologies**:
- **Cloudflare Worker** - Main interaction handler
- **Spotify Web API** - OAuth 2.0 + playback control
- **Cloudflare KV** - Persistent token storage (survives worker restarts)
- **OpenRouter API** - Natural language intent parsing
- **HMAC Signatures** - Stateless OAuth state management (no in-memory state)
- **Discord Components** - Interactive buttons for search results

**Key Features**:
- **Persistent Storage**: Access/refresh tokens survive worker restarts (KV)
- **Smart Device Targeting**: Auto-activates first available Spotify device
- **Stateless OAuth**: HMAC-signed state eliminates need for in-memory storage
- **Rate Limiting**: 10-second cooldown on natural language queries (prevents API abuse)
- **Intent-Based Architecture**: LLM parses natural language → structured intents → Spotify actions
- **Agentic Loop**: Multi-iteration retry logic for complex queries (up to 3 attempts)
- **Interactive UI**: Discord button components for search results

**Worker URL**: `https://monica-spotify.<your-subdomain>.workers.dev`

---

## 🔧 Implementation Deep Dive

### Discord Interaction Verification

Every Discord bot **must** verify webhook signatures using Ed25519 cryptography for security. This prevents unauthorized requests from spoofing Discord.

```typescript
async function verifyDiscordRequest(
  request: Request,
  publicKey: string
): Promise<boolean> {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();

  // Import public key using Web Crypto API
  const key = await crypto.subtle.importKey(
    'raw',
    hexToUint8Array(publicKey),
    { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' },
    false,
    ['verify']
  );

  // Verify signature against timestamp + body
  return await crypto.subtle.verify(
    'NODE-ED25519',
    key,
    hexToUint8Array(signature),
    new TextEncoder().encode(timestamp + body)
  );
}
```

**Why this matters**:
- Discord requires signature verification for security (prevents replay attacks)
- Workers use Web Crypto API (not Node.js `crypto` module)
- Invalid signatures return 401, causing Discord to retry and eventually disable endpoint
- Signature includes timestamp to prevent replay attacks

---

### Deferred Response Pattern

Discord requires responses within **3 seconds** or the interaction fails. For operations that take longer (LLM calls, API requests), use the deferred response pattern:

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const interaction = await request.json();

    // Immediately respond with "deferred" to prevent timeout
    ctx.waitUntil(handleCommandAsync(interaction, env));

    return json({
      type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      data: { flags: 64 } // 64 = EPHEMERAL (optional)
    });
  },
};

async function handleCommandAsync(interaction: DiscordInteraction, env: Env) {
  // Long-running operation (can take 10+ seconds)
  const result = await callExternalAPI();

  // Send follow-up message via webhook
  const webhookUrl = `https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`;
  await fetch(webhookUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: result }),
  });
}
```

**Key points**:
- `ctx.waitUntil()` keeps worker alive after response is sent to Discord
- User sees "Bot is thinking..." indicator until follow-up arrives
- Follow-up messages use Discord webhook API (not interaction response)
- Can edit original message or send new messages
- Webhook token expires after 15 minutes

---

### Persistent Storage with Cloudflare KV

**Problem**: Workers can restart at any time (cold starts, deployments, scaling), losing all in-memory data.

**Solution**: Cloudflare KV for persistent, globally distributed key-value storage.

```typescript
// Create KV namespace (run once)
// $ wrangler kv:namespace create "SPOTIFY_TOKENS"

// wrangler.toml configuration
[[kv_namespaces]]
binding = "SPOTIFY_TOKENS"
id = "4e9afc5c83394af987c57a83012e30b8"

// TypeScript interface
interface Env {
  SPOTIFY_TOKENS: KVNamespace;
}

// Usage: Store user tokens
export async function storeUserTokens(
  kv: KVNamespace,
  userId: string,
  tokens: SpotifyTokens
) {
  await kv.put(
    `user:${userId}`,
    JSON.stringify(tokens),
    { expirationTtl: 60 * 60 * 24 * 30 } // 30 days
  );
}

// Usage: Retrieve user tokens
export async function getUserTokens(
  kv: KVNamespace,
  userId: string
): Promise<SpotifyTokens | null> {
  const data = await kv.get(`user:${userId}`, 'text');
  return data ? JSON.parse(data) : null;
}
```

**Why KV?**:
- **Globally distributed** - Data replicated to 300+ edge locations (low latency)
- **Eventually consistent** - Writes propagate within seconds
- **Free tier** - 100,000 reads/day, 1,000 writes/day
- **TTL support** - Automatic expiration for temporary data
- **Perfect for** - User sessions, OAuth tokens, preferences

**Trade-offs**:
- Not suitable for frequent writes (rate limit: 1 write/sec per key)
- Eventually consistent (2-60 second propagation delay)
- Value size limit: 25 MB per key

---

### Stateless OAuth with HMAC

**Problem**: Traditional OAuth stores state in memory → lost on worker restart → "Invalid state" errors for users mid-flow.

**Solution**: Stateless OAuth using cryptographically signed state parameter (HMAC-SHA256).

```typescript
// Generate signed state (no database needed)
export async function createSignedState(
  data: OAuthState,
  secret: string
): Promise<string> {
  // Encode state data as base64
  const encoded = btoa(JSON.stringify({
    userId: data.userId,
    timestamp: Date.now(),
    nonce: crypto.randomUUID()
  }));

  // Generate HMAC signature
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(encoded)
  );

  // Return: base64_data.hex_signature
  return `${encoded}.${hexFromBuffer(signature)}`;
}

// Verify signed state (no database lookup)
export async function verifySignedState(
  state: string,
  secret: string
): Promise<OAuthState | null> {
  const [encoded, providedSig] = state.split('.');

  // Recompute HMAC signature
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    hexToUint8Array(providedSig),
    new TextEncoder().encode(encoded)
  );

  if (!isValid) return null;

  const data = JSON.parse(atob(encoded));

  // Check expiration (10 minutes)
  if (Date.now() - data.timestamp > 10 * 60 * 1000) {
    return null;
  }

  return data;
}
```

**Benefits**:
- **No database/storage needed** - State is self-contained
- **Survives worker restarts** - No in-memory dependency
- **CSRF protection** - Signature prevents tampering
- **Time-limited** - Expires after 10 minutes
- **Stateless** - Can be verified by any worker instance

**Security properties**:
- Attacker cannot forge state without secret key
- Signature prevents modification of userId or timestamp
- Nonce prevents replay attacks
- Expiration limits attack window

---

### Natural Language Processing with LLM

The Spotify bot uses an LLM (via OpenRouter) to parse natural language into structured intents:

```typescript
// User input: "play some jazz"
const intent = await interpretQuery("play some jazz", env);

// LLM returns structured intent:
{
  intent: "search",
  track: null,
  artist: null,
  album: null,
  playlist: null,
  genre: "jazz",
  query: null
}

// Intent is mapped to Spotify API call:
await spotifyClient.search("jazz", ["track"], 10);
```

**System Prompt Architecture**:
```typescript
const SYSTEM_PROMPT = `
<spotify_intent_parser>
    <role>Extract structured music data from natural language</role>
    <task>Parse user queries and identify intent plus relevant music entities</task>

    <output_schema>
        {
            "intent": "play | pause | next | previous | search | list_playlist_tracks | ...",
            "track": "string | null",
            "artist": "string | null",
            "album": "string | null",
            "playlist": "string | null",
            "genre": "string | null",
            "query": "string | null"
        }
    </output_schema>

    <examples>
        <example>
            <input>play paper rings by taylor swift</input>
            <output>{"intent":"search","track":"paper rings","artist":"taylor swift",...}</output>
        </example>
    </examples>
</spotify_intent_parser>
`;
```

**Why XML-style prompting?**
- Avoids Meta LLaMA's moderation filters (plain text prompts get flagged)
- Clearer structure for the model
- Better consistency in JSON output

**Agentic Loop**:
```typescript
// Retry logic for complex queries
for (let i = 0; i < maxIterations; i++) {
  const intent = await interpretQuery(query, env);
  const result = await executeIntent(intent, spotifyClient);

  if (result.success) {
    return result; // Success
  }

  // Analyze failure and decide whether to retry
  if (!shouldRetry(result)) {
    return result; // Give up
  }
}
```

---

### Interactive Discord Components

The `/play` command uses Discord's button components for user interaction:

```typescript
// Create button components
const components = [
  {
    type: 1, // ACTION_ROW (container for buttons)
    components: [
      {
        type: 2, // BUTTON
        style: 3, // SUCCESS (green button)
        label: 'Play',
        custom_id: `play_track_${trackUri}`, // State passed to handler
      },
      {
        type: 2,
        style: 4, // DANGER (red button)
        label: 'Cancel',
        custom_id: 'cancel_search',
      },
    ],
  },
];

// Return message with buttons
return messageResponseWithComponents(message, components, true);
```

**Handling Button Clicks**:
```typescript
// Button interactions have type = MESSAGE_COMPONENT
if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
  const customId = interaction.data.custom_id;

  if (customId.startsWith('play_track_')) {
    const trackUri = customId.replace('play_track_', '');
    await spotifyClient.play({ uris: [trackUri] });

    // Update message (removes buttons)
    return updateMessageResponse('▶️ Now playing!');
  }

  if (customId === 'cancel_search') {
    return updateMessageResponse('❌ Search cancelled.');
  }
}
```

**Why buttons over autoplay?**
- Discord doesn't support timed/automatic button clicks
- No way to implement countdown timers on messages
- User confirmation prevents accidental playback
- Better UX for browsing multiple results

---

## 📁 Project Structure

```
monica/
├── monica-core/                    # Core Bot Worker
│   ├── src/
│   │   └── worker.ts              # Main entry point (200 lines)
│   ├── wrangler.toml              # Worker configuration
│   ├── .env                       # Secrets (gitignored)
│   ├── package.json
│   ├── tsconfig.json
│   └── register-commands.js       # Discord command registration script
│
├── monica-spotify/                 # Spotify Bot Worker
│   ├── src/
│   │   ├── index.ts               # Main entry point (300 lines)
│   │   ├── commands/              # Command handlers (modular)
│   │   │   ├── link.ts            # OAuth flow handler
│   │   │   ├── play.ts            # Resume playback (old /play)
│   │   │   ├── search.ts          # Search with buttons (new /play)
│   │   │   ├── pause.ts           # Pause handler
│   │   │   ├── next.ts            # Skip next handler
│   │   │   ├── previous.ts        # Skip previous handler
│   │   │   ├── nowplaying.ts      # Current track display
│   │   │   └── playlists.ts       # Playlist browser (filters followed)
│   │   ├── spotify/
│   │   │   ├── client.ts          # Spotify API wrapper (300 lines)
│   │   │   └── oauth.ts           # HMAC-signed OAuth (200 lines)
│   │   ├── llm/
│   │   │   ├── interpreter.ts     # LLM intent parser (250 lines)
│   │   │   └── agent.ts           # Agentic loop with retry logic
│   │   └── utils/
│   │       ├── discord.ts         # Discord API helpers (200 lines)
│   │       ├── storage.ts         # KV storage layer
│   │       ├── ratelimit.ts       # In-memory rate limiting
│   │       └── mapper.ts          # Intent → Spotify API execution (600 lines)
│   ├── wrangler.toml              # Worker configuration
│   ├── .env                       # Secrets (gitignored)
│   ├── package.json
│   ├── tsconfig.json
│   └── register-commands.js       # Discord command registration script
│
├── README.md                       # This file (comprehensive guide)
├── CLAUDE.md                       # AI coding assistant context
├── .gitignore                      # Excludes .env, node_modules, etc.
└── LICENSE                         # MIT License
```

**Code Statistics**:
- **Total TypeScript**: ~2,500 lines
- **Core Bot**: ~200 lines
- **Spotify Bot**: ~2,300 lines
- **Test Coverage**: Vitest integration tests

---

## 🚀 Deployment Guide

### Prerequisites

1. **Cloudflare Account**: [Sign up free](https://dash.cloudflare.com/sign-up)
2. **Discord Applications**: Create two apps at [Discord Developer Portal](https://discord.com/developers/applications)
   - One for Core Bot
   - One for Spotify Bot
3. **Wrangler CLI**: `npm install -g wrangler`
4. **Authentication**: `wrangler login`
5. **External API Keys**:
   - [OpenRouter API Key](https://openrouter.ai/keys) (free tier available)
   - [Brave Search API Key](https://brave.com/search/api/) (2,000 queries/month free)
   - [Spotify App](https://developer.spotify.com/dashboard) (client ID + secret)

### Step 1: Deploy Core Bot

```bash
cd monica-core

# Install dependencies
npm install

# Compile TypeScript (verify no errors)
npx tsc --noEmit

# Set secrets (interactive prompts)
wrangler secret put DISCORD_PUBLIC_KEY    # From Discord App → General Information
wrangler secret put OPENROUTER_API_KEY    # From OpenRouter dashboard
wrangler secret put BRAVE_API_KEY         # From Brave Search API dashboard

# Deploy to Cloudflare
npm run deploy
# → Output: https://monica-core.YOUR_SUBDOMAIN.workers.dev

# Register Discord commands
DISCORD_BOT_TOKEN=<your_bot_token> APPLICATION_ID=<your_app_id> node register-commands.js
```

### Step 2: Deploy Spotify Bot

```bash
cd monica-spotify

# Install dependencies
npm install

# Create KV namespace for token storage
wrangler kv:namespace create "SPOTIFY_TOKENS"
# → Output: Add this to wrangler.toml:
#    [[kv_namespaces]]
#    binding = "SPOTIFY_TOKENS"
#    id = "YOUR_KV_ID_HERE"

# Update wrangler.toml with KV namespace ID
vim wrangler.toml  # Add KV ID from above

# Set secrets (bulk upload from .env file)
# First, create .env file with your secrets:
cat > .env << EOF
DISCORD_PUBLIC_KEY=<from_discord_app>
DISCORD_BOT_TOKEN=<from_discord_bot>
APPLICATION_ID=<discord_app_id>
SPOTIFY_CLIENT_ID=<from_spotify_dashboard>
SPOTIFY_CLIENT_SECRET=<from_spotify_dashboard>
SPOTIFY_REDIRECT_URI=https://monica-spotify.YOUR_SUBDOMAIN.workers.dev/oauth/callback
OPENROUTER_API_KEY=<from_openrouter>
EOF

# Upload all secrets at once
wrangler secret bulk .env

# Deploy to Cloudflare
npm run deploy
# → Output: https://monica-spotify.YOUR_SUBDOMAIN.workers.dev

# Register Discord commands
DISCORD_BOT_TOKEN=<your_bot_token> APPLICATION_ID=<your_app_id> node register-commands.js
```

### Step 3: Configure Discord Interactions Endpoint

For **each bot** (Core and Spotify):

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Navigate to **General Information**
4. **Interactions Endpoint URL**:
   - Core Bot: `https://monica-core.YOUR_SUBDOMAIN.workers.dev`
   - Spotify Bot: `https://monica-spotify.YOUR_SUBDOMAIN.workers.dev`
5. Click **Save Changes**
6. Discord will verify the endpoint (green checkmark if successful)
   - If verification fails, check:
     - Worker is deployed and accessible
     - DISCORD_PUBLIC_KEY is correct
     - Signature verification code is working

### Step 4: Configure Spotify OAuth

For Spotify Bot only:

1. Go to [Spotify Dashboard](https://developer.spotify.com/dashboard)
2. Select your app
3. **Settings** → **Redirect URIs**
4. Add: `https://monica-spotify.YOUR_SUBDOMAIN.workers.dev/oauth/callback`
5. Click **Save**

### Step 5: Invite Bots to Discord Server

For **each bot**:

1. Discord Developer Portal → Your Application
2. **OAuth2** → **URL Generator**
3. **Scopes**: Check `bot` and `applications.commands`
4. **Bot Permissions**:
   - Core Bot: `Send Messages`, `Use Slash Commands`
   - Spotify Bot: `Send Messages`, `Use Slash Commands`
5. Copy generated URL
6. Open in browser and select server to invite bot

### Step 6: Verify Deployment

```bash
# Test Core Bot endpoint
curl https://monica-core.YOUR_SUBDOMAIN.workers.dev
# → Should return: "Monica is running on Discord"

# Test Spotify Bot endpoint
curl https://monica-spotify.YOUR_SUBDOMAIN.workers.dev
# → Should return: "SpotiBot - Spotify Discord Bot"

# Check logs in real-time
cd monica-core && wrangler tail
cd monica-spotify && wrangler tail

# Verify commands appear in Discord
# Type "/" in Discord and you should see both bots' commands
```

---

## 🔑 Environment Variables Reference

### Core Bot (.env)

```env
# Discord Bot Configuration
DISCORD_PUBLIC_KEY=c2f50969eede1bf005bcbe55e9a12abb...     # From Discord App settings
DISCORD_BOT_TOKEN=MTQzMjg4NjYyMDA3MTEzMzI3NQ.GU7f4q...      # From Discord Bot settings
APPLICATION_ID=1432886620071133275                          # Discord Application ID

# API Keys
OPENROUTER_API_KEY=sk-or-v1-e584d33fd020b30be2c4165ba...   # OpenRouter API key
BRAVE_API_KEY=BSA8ArETBeo_amr1x3cV9qb1lzYUfKc             # Brave Search API key
```

### Spotify Bot (.env)

```env
# Discord Bot Configuration (separate app from Core Bot)
DISCORD_PUBLIC_KEY=3092e0d6786cd16c93fce47ce6aaf694...     # From Discord App settings
DISCORD_BOT_TOKEN=MTQzMzEwNDgwOTQ1OTk3NDE5Ng.GkAEan...      # From Discord Bot settings
APPLICATION_ID=1433104809459974196                          # Discord Application ID

# Spotify Configuration
SPOTIFY_CLIENT_ID=83bbc091470749e5a7defcbcdba7ed78        # Spotify App client ID
SPOTIFY_CLIENT_SECRET=7077e0f392264d6ea0d368b4227c4bbe   # Spotify App secret
SPOTIFY_REDIRECT_URI=https://monica-spotify.YOUR.workers.dev/oauth/callback

# OpenRouter (shared with Core Bot)
OPENROUTER_API_KEY=sk-or-v1-e584d33fd020b30be2c4165ba...   # OpenRouter API key
```

**Security Notes:**
- `.env` files are in `.gitignore` (never commit secrets)
- Secrets stored securely in Cloudflare (encrypted at rest)
- Each bot has isolated secrets and KV namespaces
- Never log or expose secrets in code
- Rotate keys periodically

---

## 🎯 Key Design Patterns & Best Practices

### 1. Modular Bot Architecture

Each bot is an **independent Cloudflare Worker** with isolated resources:

```
Benefits:
✅ Separate codebase and deployment pipeline
✅ Isolated secrets and KV namespaces (security)
✅ Independent scaling and resource limits
✅ Deploy/update without affecting other bots
✅ Easier debugging with isolated logs
✅ Can use different programming patterns per bot

Trade-offs:
⚠️ No shared code (use npm packages for shared logic)
⚠️ Each bot counts against worker limits separately
```

### 2. Command Registration Pattern

Discord commands must be registered via API (separate from deployment):

```javascript
// register-commands.js - Run after deployment
const commands = [
  {
    name: 'play',
    description: 'Search Spotify for tracks and play them',
    dm_permission: false, // Guild-only command
    options: [{
      name: 'query',
      description: 'Track name, artist, or search query',
      type: 3, // STRING (Discord option type)
      required: true,
    }],
  },
];

// PUT replaces all commands (idempotent)
await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bot ${BOT_TOKEN}`,
  },
  body: JSON.stringify(commands),
});
```

**Best practices**:
- Use `PUT /applications/{id}/commands` to replace all commands atomically
- Set `dm_permission: false` for commands requiring server context
- Use option types correctly: 3=STRING, 4=INTEGER, 5=BOOLEAN, etc.
- Commands update globally within 1 hour (guild commands update instantly)

### 3. Smart Device Handling (Spotify)

Automatically finds and activates available Spotify devices:

```typescript
async playSmartly() {
  try {
    // Try playing on current active device
    await this.play();
    return { success: true };
  } catch (error) {
    // No active device found (404 error)
    if (error.status === 404) {
      // Get list of all available devices
      const device = await this.getActiveOrAvailableDevice();

      if (!device) {
        throw new Error('No Spotify devices available');
      }

      // Transfer playback to device and start playing
      await this.transferPlayback(device.id, true);
      return { success: true, device };
    }
    throw error;
  }
}
```

**Why this matters**:
- Spotify requires an "active device" to play music
- Users often have Spotify closed or inactive
- This pattern auto-activates the first available device
- Improves UX by eliminating "no device" errors

### 4. Rate Limiting (In-Memory)

Prevents LLM API abuse with per-user cooldowns:

```typescript
// Simple in-memory rate limiter
const rateLimitStore = new Map<string, { lastRequestTime: number }>();
const COOLDOWN_MS = 10 * 1000; // 10 seconds

export function checkRateLimit(userId: string) {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (entry && now - entry.lastRequestTime < COOLDOWN_MS) {
    return {
      isLimited: true,
      remainingMs: COOLDOWN_MS - (now - entry.lastRequestTime),
    };
  }

  return { isLimited: false, remainingMs: 0 };
}

export function recordRequest(userId: string) {
  rateLimitStore.set(userId, { lastRequestTime: Date.now() });
}
```

**Trade-offs**:
- ✅ Fast (no external storage)
- ✅ Simple implementation
- ❌ Lost on worker restart (acceptable for rate limits)
- ❌ Not shared across worker instances (acceptable for rate limits)

**Alternative**: Use Cloudflare Durable Objects for distributed rate limiting.

### 5. Error Handling & User Feedback

Always provide helpful error messages to users:

```typescript
try {
  await spotifyClient.play();
} catch (error) {
  if (error instanceof SpotifyAPIError) {
    switch (error.status) {
      case 404:
        return messageResponse(
          '❌ No active Spotify device found.\n\n' +
          'Open Spotify on any device, or use the Web Player:\n' +
          'https://open.spotify.com',
          true
        );
      case 403:
        return messageResponse(
          '❌ Cannot start playback.\n\n' +
          'You need an active Spotify Premium subscription to use playback controls.',
          true
        );
      case 401:
        return messageResponse(
          '❌ Your Spotify session has expired.\n\n' +
          'Please use `/linkspotify` to reconnect your account.',
          true
        );
      default:
        return messageResponse(
          `❌ Spotify API error (${error.status}). Please try again.`,
          true
        );
    }
  }

  // Unknown error - log and show generic message
  console.error('Unexpected error:', error);
  return messageResponse(
    '❌ An unexpected error occurred. Please try again.',
    true
  );
}
```

**Principles**:
- Specific, actionable error messages
- Include links to external resources when helpful
- Log unknown errors for debugging
- Use ephemeral messages (flags: 64) for errors

---

## 💡 Lessons Learned & Common Pitfalls

### 1. Workers Don't Support `setTimeout` or `setInterval`

❌ **Don't do this:**
```typescript
// This will NOT work in Cloudflare Workers
setTimeout(() => {
  oauthStates.delete(state);
}, 10 * 60 * 1000);
```

✅ **Do this instead:**
```typescript
// Option 1: Opportunistic cleanup (lazy deletion)
if (Math.random() < 0.01) { // 1% of requests
  cleanupExpiredStates();
}

// Option 2: Use KV with expiration
await kv.put(key, value, { expirationTtl: 600 }); // Auto-delete after 10 min

// Option 3: Use Durable Objects alarms
```

**Why**: Workers are stateless request handlers, not long-running processes.

### 2. In-Memory Storage is Ephemeral

Workers can restart at any time:
- **Cold starts** after period of inactivity (~15 minutes)
- **Deployments** (instant cutover to new code)
- **Traffic spikes** (Cloudflare scales up instances)
- **Resource limits** (CPU/memory exceeded)

❌ **Don't do this:**
```typescript
const userTokens = new Map<string, SpotifyTokens>();

// This data will be lost on restart!
userTokens.set(userId, tokens);
```

✅ **Do this instead:**
```typescript
// Use KV for persistent data
await env.SPOTIFY_TOKENS.put(`user:${userId}`, JSON.stringify(tokens));

// Use in-memory only for:
// - Transient state (rate limits, caches)
// - Data that's acceptable to lose
```

**Rule of thumb**: If it needs to survive a restart, use KV or Durable Objects.

### 3. Discord 3-Second Timeout

Discord **requires** a response within 3 seconds or the interaction fails.

❌ **Don't do this:**
```typescript
async fetch(request: Request, env: Env) {
  const interaction = await request.json();

  // LLM call takes 5-10 seconds
  const llmResponse = await callLLM(query);

  // Too late! Discord already timed out
  return json({ content: llmResponse });
}
```

✅ **Do this instead:**
```typescript
async fetch(request: Request, env: Env, ctx: ExecutionContext) {
  const interaction = await request.json();

  // Immediately respond with "deferred"
  ctx.waitUntil(handleAsync(interaction, env));

  return json({ type: 5 }); // Responds in <100ms
}

async function handleAsync(interaction, env) {
  const llmResponse = await callLLM(query); // Takes 10 seconds
  await sendFollowup(interaction.token, llmResponse);
}
```

**Why**: `ctx.waitUntil()` keeps the worker alive after the response is sent.

### 4. OAuth State Must Be Stateless

Using in-memory state breaks OAuth flows:

❌ **In-memory OAuth state:**
```typescript
const oauthStates = new Map<string, OAuthState>();

// Store state
oauthStates.set(state, { userId });

// Worker restarts...

// Callback fails: state not found!
if (!oauthStates.has(state)) {
  return new Response('Invalid state', { status: 400 });
}
```

✅ **HMAC-signed state (stateless):**
```typescript
// Encode state + signature (no storage)
const signedState = await createSignedState({ userId }, secret);

// Worker restarts... doesn't matter!

// Verify signature (no storage lookup)
const data = await verifySignedState(state, secret);
if (!data) {
  return new Response('Invalid state', { status: 400 });
}
```

**Why**: HMAC signatures make state self-verifying, eliminating storage dependency.

### 5. KV is Eventually Consistent

Writes to KV take 2-60 seconds to propagate globally.

❌ **Don't do this:**
```typescript
await kv.put('key', 'value');
const result = await kv.get('key'); // Might return null!
```

✅ **Do this instead:**
```typescript
// Option 1: Return value locally after write
await kv.put('key', value);
return value; // Don't re-read from KV

// Option 2: Use cache bypass for testing
const result = await kv.get('key', { cacheTtl: 0 });

// Option 3: Accept eventual consistency
// Design your app to tolerate stale reads
```

**Best practice**: Treat KV as a cache, not a database. Don't rely on immediate consistency.

### 6. TypeScript Configuration for Workers

Workers use ES modules and modern JavaScript:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  }
}
```

**Key settings**:
- `moduleResolution: "bundler"` - Required for Workers
- `isolatedModules: true` - Each file is a separate module
- `types: ["@cloudflare/workers-types"]` - Workers API types

---

## 📊 Performance & Cost Analysis

### Cloudflare Workers Free Tier

- **Requests**: 100,000/day per worker (per bot)
- **CPU Time**: 10ms per request (soft limit: 50ms, hard limit: 30 seconds)
- **KV Reads**: 100,000/day
- **KV Writes**: 1,000/day
- **Bandwidth**: Unlimited inbound/outbound
- **Duration**: Up to 30 seconds with `ctx.waitUntil()`

### External API Costs

| Service | Free Tier | Paid Tier | Notes |
|---------|-----------|-----------|-------|
| **OpenRouter** | 10 requests/min | $0.00006/1K tokens | LLaMA 4 Scout is free |
| **Brave Search** | 2,000 queries/month | $5/1K queries | Rate limit: 1 req/sec |
| **Spotify API** | Free | Free | Requires Premium for playback |
| **Discord API** | Free | Free | No rate limits for bots |

### Real-World Usage (100 Users)

```
Daily Usage Estimate:

Core Bot:
- 50 AI chats (/ask)               → 50 worker requests
- 20 web searches (/web-search)    → 20 worker requests + 20 Brave API calls
- ~100 LLM tokens per request       → 7,000 tokens/day (~$0.00042)

Spotify Bot:
- 500 playback commands            → 500 worker requests
- 50 natural language queries      → 50 LLM calls (~$0.00030)
- 100 OAuth flows                  → 100 worker requests + 200 KV writes
- 1,000 token reads                → 1,000 KV reads

Total per day:
- 820 worker requests              → Well within 100K limit
- 20 Brave searches                → 1% of free tier
- 200 KV writes                    → 20% of free tier
- 1,000 KV reads                   → 1% of free tier
- ~$0.001 in LLM costs             → ~$0.03/month

Monthly cost: $0.03 (essentially free)
```

**Scaling**:
- **1,000 users**: ~$0.30/month (still within free tier)
- **10,000 users**: ~$3/month (may need paid Brave tier)
- **100,000 users**: ~$30/month + paid Workers tier

---

## 🐛 Troubleshooting Guide

### Discord Endpoint Verification Fails

**Error**: "The specified interactions endpoint URL could not be verified"

**Common causes**:
1. Wrong `DISCORD_PUBLIC_KEY` in secrets
2. Worker not deployed or not accessible
3. Bug in signature verification code
4. CORS issues (should not affect Workers)

**Fix**:
```bash
# 1. Verify worker is accessible
curl https://your-worker.workers.dev
# Should return: "Monica is running on Discord" (or similar)

# 2. Check logs for signature verification errors
wrangler tail

# 3. Re-upload public key (copy exactly from Discord)
wrangler secret put DISCORD_PUBLIC_KEY
# Paste the key from: Discord Dev Portal → Your App → General Information → Public Key

# 4. Redeploy worker
npm run deploy

# 5. Try verification again in Discord
```

### Commands Don't Appear in Discord

**Cause**: Commands not registered or Discord cache

**Fix**:
```bash
# 1. Re-register commands
cd monica-core (or monica-spotify)
DISCORD_BOT_TOKEN=xxx APPLICATION_ID=yyy node register-commands.js

# 2. Wait 5-10 minutes for Discord's global command cache to update

# 3. Try in a different server (guild commands update instantly)

# 4. Kick and re-invite bot to clear cache

# 5. Verify commands were registered
curl -H "Authorization: Bot YOUR_BOT_TOKEN" \
  https://discord.com/api/v10/applications/YOUR_APP_ID/commands
```

### Spotify "No Active Device" Error

**Cause**: User has no Spotify device open or active

**Fix** (users must do this):
1. Open Spotify on **any device** (desktop, mobile, web player)
2. Play any song to activate the device
3. Try the bot command again

**Alternative**: Use Web Player
- Bot provides link: https://open.spotify.com
- Opens Spotify in browser
- Auto-activates as device

### Spotify "Invalid or Expired State" (OAuth)

**Cause**: Worker restarted during OAuth flow (should be fixed with HMAC state)

**Fix**:
1. Verify HMAC implementation is deployed
2. Check secret is consistent: `wrangler secret list`
3. Restart OAuth flow (click `/linkspotify` again)

### KV Returns Null After Write

**Cause**: KV eventual consistency (2-60 second delay)

**Fix**:
```typescript
// Don't re-read immediately after write
await kv.put('key', value);
return value; // Use local value

// Or add cache bypass for testing
const result = await kv.get('key', { cacheTtl: 0 });
```

**Permanent solution**: Design app to tolerate eventual consistency.

### Worker CPU Time Exceeded

**Error**: "Worker exceeded CPU time limit"

**Cause**: Long-running synchronous code (>50ms)

**Fix**:
```typescript
// Don't do heavy computation in request handler
// Use async operations and ctx.waitUntil()

// Bad:
for (let i = 0; i < 1000000; i++) {
  heavyComputation();
}

// Good:
ctx.waitUntil(async () => {
  await heavyComputationAsync();
});
```

### Rate Limit Errors from APIs

**OpenRouter**: 10 requests/minute on free tier
**Brave Search**: 1 request/second

**Fix**:
- Implement client-side rate limiting
- Queue requests if needed
- Upgrade to paid tier for higher limits

---

## 🔐 Security Best Practices

### 1. Signature Verification

**Always verify Discord signatures** on every request:

```typescript
// NEVER skip this check
const isValid = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY);
if (!isValid) {
  return new Response('Invalid signature', { status: 401 });
}
```

**Why**: Prevents unauthorized requests from spoofing Discord.

### 2. Secrets Management

```bash
# ✅ Use wrangler secret (encrypted at rest)
wrangler secret put API_KEY

# ❌ Never commit secrets to git
echo "API_KEY=secret" >> .env  # OK (gitignored)
git add .env                   # BAD! Don't do this!

# ❌ Never hardcode secrets
const API_KEY = "sk-...";  // BAD!
```

### 3. Rate Limiting

Implement per-user rate limits to prevent abuse:

```typescript
const { isLimited, remainingMs } = checkRateLimit(userId);

if (isLimited) {
  return messageResponse(
    `⏱️ Slow down! Try again in ${Math.ceil(remainingMs / 1000)} seconds.`,
    true
  );
}

recordRequest(userId);
```

### 4. OAuth CSRF Protection

Always validate OAuth state:

```typescript
// Generate signed state with expiration
const state = await createSignedState({ userId, timestamp: Date.now() }, secret);

// On callback, verify signature and expiration
const data = await verifySignedState(state, secret);
if (!data) {
  return new Response('Invalid or expired state', { status: 400 });
}

if (data.userId !== expectedUserId) {
  return new Response('State tampering detected', { status: 400 });
}
```

### 5. Input Validation

Sanitize user inputs before external API calls:

```typescript
// Validate length
if (query.length > 200) {
  return messageResponse('Query too long (max 200 characters)', true);
}

// Validate characters (prevent injection)
if (!/^[a-zA-Z0-9\s\-_]+$/.test(query)) {
  return messageResponse('Invalid characters in query', true);
}

// Escape special characters for external APIs
const safeQuery = escapeHtml(query);
```

### 6. HTTPS Only

Workers enforce HTTPS automatically, but verify redirect URIs:

```typescript
// Spotify redirect URI must use HTTPS
SPOTIFY_REDIRECT_URI=https://monica-spotify.workers.dev/oauth/callback

// ❌ HTTP will fail OAuth
SPOTIFY_REDIRECT_URI=http://...  // BAD!
```

### 7. Minimal Permissions

Request only necessary Discord permissions:

```
Core Bot:
- Send Messages
- Use Slash Commands

Spotify Bot:
- Send Messages
- Use Slash Commands

Don't request:
- Administrator (never needed for bots)
- Manage Server
- Manage Roles
```

---

## 🚧 Future Enhancements & Ideas

Potential additions to the Monica platform:

### Additional Bots

1. **Calendar Bot** - Google Calendar integration
   - `/schedule <event>` - Create calendar events with natural language
   - `/agenda` - Show today's schedule
   - KV storage for user calendar tokens

2. **Task Bot** - Todo list management
   - `/todo add <task>` - Add tasks
   - `/todo list` - Show pending tasks
   - Durable Objects for real-time task sync

3. **Voice Bot** - Voice channel utilities
   - `/join` - Join voice channel
   - `/play <url>` - Play audio from URL
   - Requires Cloudflare Calls API

4. **Mod Bot** - Moderation tools
   - `/warn <user> <reason>` - Warn users
   - `/ban <user> <duration>` - Temporary bans
   - Analytics Dashboard integration

### Technical Improvements

1. **Observability**
   - Structured logging with `console.log({ level, message, metadata })`
   - OpenTelemetry integration
   - Cloudflare Analytics integration

2. **Testing**
   - Unit tests with Vitest
   - Integration tests with `@cloudflare/vitest-pool-workers`
   - E2E tests with Discord test bot

3. **Performance**
   - Response caching with Cache API
   - LLM response streaming
   - Parallel API calls where possible

4. **User Experience**
   - Embed messages instead of plain text
   - Autocomplete for commands
   - Context menus (right-click actions)

---

## 📚 Learning Resources

### Cloudflare Platform

- **Workers Docs**: https://developers.cloudflare.com/workers/
- **KV Storage**: https://developers.cloudflare.com/kv/
- **Durable Objects**: https://developers.cloudflare.com/durable-objects/
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler/
- **Workers Examples**: https://github.com/cloudflare/workers-sdk/tree/main/templates

### Discord Development

- **Interactions Guide**: https://discord.com/developers/docs/interactions/receiving-and-responding
- **Slash Commands**: https://discord.com/developers/docs/interactions/application-commands
- **Message Components**: https://discord.com/developers/docs/interactions/message-components
- **OAuth2 Guide**: https://discord.com/developers/docs/topics/oauth2
- **Discord.js Guide**: https://discordjs.guide/ (not used here, but helpful reference)

### External APIs

- **OpenRouter**: https://openrouter.ai/docs
  - Model comparison: https://openrouter.ai/models
- **Brave Search**: https://brave.com/search/api/
- **Spotify Web API**: https://developer.spotify.com/documentation/web-api
  - OAuth guide: https://developer.spotify.com/documentation/web-api/tutorials/code-flow

### TypeScript & Web APIs

- **TypeScript Handbook**: https://www.typescriptlang.org/docs/handbook/intro.html
- **Web Crypto API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- **Fetch API**: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

This project is open source and free to use, modify, and distribute. No attribution required, but appreciated!

---

## 🤝 Contributing

This is an educational project demonstrating serverless Discord bot patterns. Contributions welcome!

**Ways to contribute:**
- 🐛 Report bugs via [GitHub Issues](https://github.com/yourusername/monica/issues)
- 💡 Suggest features or improvements
- 📖 Improve documentation
- 🔧 Submit pull requests with fixes or enhancements
- ⭐ Star the repo if you find it useful!

**Development setup:**
```bash
git clone https://github.com/yourusername/monica
cd monica

# Install dependencies
cd monica-core && npm install
cd ../monica-spotify && npm install

# Run tests
npm test

# Deploy to dev environment
wrangler deploy --env dev
```

---

## 👨‍💻 About This Project

**Monica** was built as a learning project to explore:
- Cloudflare Workers and edge computing
- Discord bot development with HTTP interactions
- OAuth 2.0 flows and stateless authentication
- LLM integration for natural language processing
- Production-ready serverless architecture patterns

**Built with:** [Claude Code](https://claude.com/claude-code) by Anthropic
**Tech Stack:** TypeScript, Cloudflare Workers, Discord API, Spotify Web API, OpenRouter

**Key Takeaway**: Discord bots don't need traditional servers! Cloudflare Workers + HTTP interactions = serverless, scalable, globally distributed bots with zero infrastructure overhead.

---

## 🙏 Acknowledgments

- **Cloudflare** for the incredible Workers platform
- **Discord** for comprehensive API documentation
- **OpenRouter** for easy LLM access
- **Spotify** for the powerful Web API
- **Anthropic** for Claude and Claude Code

---

**Monica AI Suite** - Demonstrating the future of Discord bot development 🤖🎵

*Last updated: October 2025*
