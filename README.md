# Monica - AI Bot Suite on Cloudflare Workers

Monica is an AI-powered Discord bot suite built entirely on **Cloudflare Workers**, demonstrating how to run serverless Discord bots on the edge with zero infrastructure management. The project showcases modular bot architecture where each bot is an independent worker with specialized capabilities.

---

## 🏗️ Architecture Overview

### Why Cloudflare Workers for Discord Bots?

Traditional Discord bots require:
- Always-on servers (VPS, EC2, etc.)
- WebSocket connections for real-time events
- Infrastructure management and scaling

**Cloudflare Workers approach**:
- ✅ **Serverless** - No servers to manage
- ✅ **Edge computing** - Runs globally at 300+ locations
- ✅ **Interaction-based** - Uses Discord's HTTP interactions (slash commands)
- ✅ **Pay-per-use** - Free tier covers typical usage
- ✅ **Auto-scaling** - Handles traffic spikes automatically
- ✅ **Zero downtime** - Deploys without restarts

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
2. **Signature Verification**: Ed25519 signature validation (required by Discord)
3. **Deferred Responses**: Immediate ACK (type 5) to avoid 3-second timeout
4. **Background Processing**: `ctx.waitUntil()` for async operations
5. **Follow-up Messages**: Edit original response via Discord API

---

## 🤖 Bot Suite Structure

```
Monica (Platform)
├── core-bot (monica-core)
│   ├── AI chat with OpenRouter
│   ├── Web search with Brave API
│   └── Edge-deployed assistant
│
└── spotify-bot (monica-spotify)
    ├── Spotify OAuth 2.0 integration
    ├── Natural language control (LLM)
    ├── Playback commands
    └── KV persistent storage
```

### 1. Core Bot (monica-core)

**Purpose**: AI assistant for conversations and web search

**Technologies**:
- **Worker**: Handles `/ask` and `/search` commands
- **OpenRouter**: LLM API (meta-llama/llama-4-scout:free)
- **Brave Search**: Web search API
- **Pattern**: Deferred response for LLM processing

**Key Features**:
- Stateless design (no storage needed)
- Summarizes search results with LLM
- 2-minute timeout protection

**Worker URL**: `https://monica-core.<your-subdomain>.workers.dev`

---

### 2. Spotify Bot (monica-spotify)

**Purpose**: Full Spotify control with natural language and direct commands

**Technologies**:
- **Worker**: Handles 8 Spotify commands
- **Spotify Web API**: OAuth 2.0 + playback control
- **Cloudflare KV**: Persistent token storage
- **OpenRouter**: Natural language interpretation
- **HMAC Signatures**: Stateless OAuth state management

**Key Features**:
- **Persistent Storage**: Tokens survive worker restarts (KV)
- **Smart Device Targeting**: Auto-activates available devices
- **Stateless OAuth**: No in-memory state (HMAC-signed)
- **Rate Limiting**: 10-second cooldown on AI queries
- **User-Created Playlists**: Filters out followed playlists

**Worker URL**: `https://monica-spotify.<your-subdomain>.workers.dev`

---

## 🔧 Implementation Details

### Discord Interaction Verification

Every Discord bot must verify webhook signatures using Ed25519:

```typescript
async function verifyDiscordRequest(
  request: Request,
  publicKey: string
): Promise<boolean> {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();

  // Import public key
  const key = await crypto.subtle.importKey(
    'raw',
    hexToUint8Array(publicKey),
    { name: 'Ed25519', namedCurve: 'Ed25519' },
    false,
    ['verify']
  );

  // Verify signature
  return await crypto.subtle.verify(
    'Ed25519',
    key,
    hexToUint8Array(signature),
    new TextEncoder().encode(timestamp + body)
  );
}
```

**Why this matters**:
- Discord requires signature verification for security
- Workers use Web Crypto API (not Node crypto)
- Invalid signatures return 401 (Discord retries)

---

### Deferred Response Pattern

Discord requires responses within **3 seconds**. For operations that take longer:

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const interaction = await request.json();

    // Immediately respond with "deferred"
    ctx.waitUntil(handleCommandAsync(interaction, env));

    return json({
      type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    });
  },
};

async function handleCommandAsync(interaction, env) {
  // Long-running operation (LLM call, API requests, etc.)
  const result = await callExternalAPI();

  // Send follow-up message
  await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: result }),
  });
}
```

**Key points**:
- `ctx.waitUntil()` keeps worker alive after response sent
- Follow-up messages use Discord webhook API
- User sees "thinking..." indicator until follow-up arrives

---

### Persistent Storage with KV

Problem: In-memory storage is lost on worker restart (happens frequently)

Solution: Cloudflare KV for persistent data

```typescript
// Create KV namespace
// wrangler kv:namespace create "SPOTIFY_TOKENS"

// wrangler.toml
[[kv_namespaces]]
binding = "SPOTIFY_TOKENS"
id = "4e9afc5c83394af987c57a83012e30b8"

// TypeScript interface
interface Env {
  SPOTIFY_TOKENS: KVNamespace;
}

// Usage
export async function storeTokens(kv: KVNamespace, userId: string, tokens: object) {
  await kv.put(`user:${userId}`, JSON.stringify(tokens));
}

export async function getTokens(kv: KVNamespace, userId: string) {
  const data = await kv.get(`user:${userId}`, 'text');
  return data ? JSON.parse(data) : null;
}
```

**Why KV?**:
- Globally distributed (low latency)
- Eventually consistent
- Free: 100k reads/day, 1k writes/day
- Perfect for user sessions/tokens

---

### Stateless OAuth with HMAC

Problem: OAuth state stored in memory → lost on restart → "Invalid state" errors

Solution: Stateless OAuth using HMAC-signed state parameter

```typescript
// Generate signed state (no storage needed)
export async function createSignedState(data: OAuthState, secret: string) {
  const encoded = btoa(JSON.stringify(data));

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

  return `${encoded}.${hexFromBuffer(signature)}`;
}

// Verify signed state (no storage lookup)
export async function verifySignedState(state: string, secret: string) {
  const [encoded, signature] = state.split('.');

  // Verify signature
  const isValid = await verifyHMAC(encoded, signature, secret);
  if (!isValid) return null;

  const data = JSON.parse(atob(encoded));

  // Check expiration
  if (Date.now() - data.timestamp > 10 * 60 * 1000) return null;

  return data;
}
```

**Benefits**:
- No database/storage needed
- Survives worker restarts
- CSRF protection via signature
- Time-limited (10 minutes)

---

## 📁 Project Structure

```
monica/
├── monica-core/                  # Core Bot Worker
│   ├── src/
│   │   └── worker.ts            # Main entry point
│   ├── wrangler.toml            # Worker config (monica-core)
│   ├── .env                     # Secrets (not in git)
│   ├── package.json
│   └── register-commands.js     # Discord command registration
│
├── monica-spotify/               # Spotify Bot Worker
│   ├── src/
│   │   ├── index.ts             # Main entry point
│   │   ├── commands/            # Command handlers (8 commands)
│   │   │   ├── link.ts          # OAuth flow
│   │   │   ├── play.ts          # Smart playback
│   │   │   ├── pause.ts
│   │   │   ├── next.ts
│   │   │   ├── previous.ts
│   │   │   ├── nowplaying.ts
│   │   │   └── playlists.ts     # User-created filter
│   │   ├── spotify/
│   │   │   ├── client.ts        # Spotify API wrapper
│   │   │   └── oauth.ts         # HMAC-signed OAuth
│   │   ├── llm/
│   │   │   └── interpreter.ts   # Natural language parser
│   │   └── utils/
│   │       ├── discord.ts       # Discord helpers
│   │       ├── storage.ts       # KV storage layer
│   │       ├── ratelimit.ts     # In-memory rate limiting
│   │       └── mapper.ts        # Intent → Spotify API
│   ├── wrangler.toml            # Worker config (monica-spotify)
│   ├── .env                     # Secrets (not in git)
│   ├── package.json
│   └── register-commands.js     # Discord command registration
│
├── README.md                     # This file
├── CLAUDE.md                     # AI coding context
└── LICENSE
```

---

## 🚀 Deployment Guide

### Prerequisites

1. **Cloudflare Account**: [Sign up](https://dash.cloudflare.com/sign-up)
2. **Discord Application**: [Create app](https://discord.com/developers/applications)
3. **Wrangler CLI**: `npm install -g wrangler`
4. **Auth**: `wrangler login`

### Deploy Core Bot

```bash
cd monica-core

# Install dependencies
npm install

# Set secrets
echo "DISCORD_PUBLIC_KEY" | wrangler secret put DISCORD_PUBLIC_KEY
echo "OPENROUTER_API_KEY" | wrangler secret put OPENROUTER_API_KEY
echo "BRAVE_API_KEY" | wrangler secret put BRAVE_API_KEY

# Deploy
npm run deploy
# → https://monica-core.YOUR_SUBDOMAIN.workers.dev

# Register Discord commands
DISCORD_BOT_TOKEN=xxx APPLICATION_ID=yyy node register-commands.js
```

### Deploy Spotify Bot

```bash
cd monica-spotify

# Install dependencies
npm install

# Create KV namespace
wrangler kv:namespace create "SPOTIFY_TOKENS"
# → Add ID to wrangler.toml

# Set secrets
wrangler secret bulk .env  # or individually

# Deploy
npm run deploy
# → https://monica-spotify.YOUR_SUBDOMAIN.workers.dev

# Register Discord commands
DISCORD_BOT_TOKEN=xxx APPLICATION_ID=yyy node register-commands.js
```

### Configure Discord

For each bot:
1. Go to Discord Developer Portal
2. **General Information** → **Interactions Endpoint URL**
3. Paste worker URL (e.g., `https://monica-core.xxx.workers.dev`)
4. Discord verifies the endpoint (green checkmark)
5. **OAuth2** → **URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Permissions: As needed
6. Invite bot to server

---

## 🔑 Environment Variables

### Core Bot (.env)

```env
DISCORD_PUBLIC_KEY=c2f50969eede...       # From Discord App settings
DISCORD_BOT_TOKEN=MTQzMjg4NjYy...        # From Discord Bot settings
APPLICATION_ID=1432886620071133275       # Discord Application ID
OPENROUTER_API_KEY=sk-or-v1-e584...     # OpenRouter API key
BRAVE_API_KEY=BSA8ArETBeo_amr...        # Brave Search API key
```

### Spotify Bot (.env)

```env
DISCORD_PUBLIC_KEY=3092e0d6786c...          # Discord App public key
DISCORD_BOT_TOKEN=MTQzMzEwNDgwOT...         # Discord Bot token
APPLICATION_ID=1433104809459974196          # Discord Application ID
SPOTIFY_CLIENT_ID=83bbc091470...            # Spotify App client ID
SPOTIFY_CLIENT_SECRET=7077e0f39226...      # Spotify App secret
SPOTIFY_REDIRECT_URI=https://...workers.dev/oauth/callback
OPENROUTER_API_KEY=sk-or-v1-e584...        # OpenRouter API key
```

**Security Notes:**
- `.env` files are in `.gitignore`
- Secrets stored in Cloudflare (not in code)
- Each bot has isolated secrets

---

## 🎯 Key Design Patterns

### 1. Modular Bot Architecture

Each bot is an independent worker:
- ✅ Separate codebase and deployment
- ✅ Isolated secrets and KV namespaces
- ✅ Independent scaling and logs
- ✅ Can deploy/update without affecting others

### 2. Command Registration

Discord commands must be registered separately:

```javascript
// register-commands.js
const commands = [
  {
    name: 'ask',
    description: 'Chat with AI assistant',
    options: [{
      name: 'query',
      description: 'What do you want to ask?',
      type: 3, // STRING
      required: true,
    }],
  },
];

await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bot ${BOT_TOKEN}`,
  },
  body: JSON.stringify(commands),
});
```

### 3. Smart Device Handling (Spotify)

Automatically finds and activates devices:

```typescript
async playSmartly() {
  try {
    // Try active device first
    await this.play();
    return { success: true };
  } catch (error) {
    if (error.status === 404) {
      // No active device - find first available
      const device = await this.getActiveOrAvailableDevice();
      if (device) {
        // Transfer playback to device
        await this.transferPlayback(device.id, true);
        return { success: true, device };
      }
    }
    throw error;
  }
}
```

### 4. Rate Limiting (In-Memory)

Prevents LLM API abuse:

```typescript
const rateLimitStore = new Map<string, { lastRequestTime: number }>();

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
```

---

## 💡 Lessons Learned

### 1. Workers Don't Support `setTimeout`

❌ **Don't do this:**
```typescript
setTimeout(() => {
  oauthStates.delete(state);
}, 10 * 60 * 1000);
```

✅ **Do this instead:**
```typescript
// Opportunistic cleanup
if (Math.random() < 0.01) {
  cleanupExpiredStates();
}

// Or use KV with expiration
await kv.put(key, value, { expirationTtl: 600 });
```

### 2. In-Memory Storage is Ephemeral

Workers can restart at any time:
- Cold starts after inactivity
- Deployments
- Traffic spikes

**Solution**: Use KV for persistent data, in-memory only for transient state.

### 3. Discord 3-Second Timeout

Long-running operations fail:

❌ **Don't do this:**
```typescript
const llmResponse = await callLLM(); // Takes 5 seconds
return json({ content: llmResponse }); // Too late!
```

✅ **Do this instead:**
```typescript
ctx.waitUntil(handleAsync(interaction, env));
return json({ type: 5 }); // Deferred - responds immediately
```

### 4. OAuth State Must Be Stateless

Using in-memory state breaks on restart:

❌ **In-memory OAuth state** → Invalid state errors

✅ **HMAC-signed state** → Works across restarts

---

## 📊 Performance & Costs

### Cloudflare Workers Free Tier

- **Requests**: 100,000/day per worker
- **CPU Time**: 10ms per request
- **KV**: 100k reads/day, 1k writes/day
- **Bandwidth**: Unlimited

### External APIs

- **OpenRouter** (LLM): Free tier available
- **Brave Search**: 2,000 queries/month free
- **Spotify**: Free (requires Premium for playback)

### Typical Usage (100 users)

```
Daily:
- 50 AI chats (/ask)         → 50 requests
- 20 searches (/search)       → 20 requests + 20 Brave API
- 500 Spotify commands        → 500 requests + 500 Spotify API
- 100 OAuth callbacks         → 100 requests + 100 KV writes

Total: ~700 requests/day (well within free tier)
Cost: $0/month 💰
```

---

## 🐛 Troubleshooting

### Discord Endpoint Verification Fails

**Error**: "The specified interactions endpoint URL could not be verified"

**Causes**:
- Wrong DISCORD_PUBLIC_KEY in secrets
- Worker not deployed
- Signature verification code has bugs

**Fix**:
```bash
# Check worker is accessible
curl https://your-worker.workers.dev

# Verify public key matches Discord app
wrangler secret put DISCORD_PUBLIC_KEY
```

### Commands Don't Appear in Discord

**Cause**: Commands not registered or Discord cache

**Fix**:
```bash
# Re-register commands
node register-commands.js

# Wait 5-10 minutes for Discord to sync
# Or kick/re-invite bot to server
```

### Spotify "Invalid or Expired State"

**Cause**: OAuth state lost due to worker restart (fixed in current version)

**Fix**: Already implemented HMAC-signed stateless OAuth

### KV Returns Null After Write

**Cause**: KV is eventually consistent (can take seconds)

**Fix**:
```typescript
// Write with metadata
await kv.put(key, value, { metadata: { writtenAt: Date.now() } });

// Read with cache bypass (for testing)
const value = await kv.get(key, { cacheTtl: 0 });
```

---

## 🔐 Security Best Practices

1. **Signature Verification**: Always verify Discord signatures
2. **Secrets Management**: Use `wrangler secret`, never commit
3. **HTTPS Only**: Workers enforce HTTPS automatically
4. **Rate Limiting**: Implement per-user cooldowns
5. **OAuth CSRF**: Use signed states with expiration
6. **Input Validation**: Sanitize user inputs before external APIs

---

## 🚧 Future Enhancements

Potential additions to the bot suite:

- **calendar-bot**: Google Calendar integration
- **task-bot**: Todo list management
- **voice-bot**: Voice channel utilities
- **mod-bot**: Moderation tools
- **analytics-bot**: Server statistics

Each would be:
- Independent Cloudflare Worker
- Separate Discord application
- Isolated KV namespace
- Part of unified "Monica" platform

---

## 📚 Resources

### Cloudflare
- [Workers Docs](https://developers.cloudflare.com/workers/)
- [KV Storage](https://developers.cloudflare.com/kv/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### Discord
- [Interactions Guide](https://discord.com/developers/docs/interactions/receiving-and-responding)
- [Slash Commands](https://discord.com/developers/docs/interactions/application-commands)
- [OAuth2](https://discord.com/developers/docs/topics/oauth2)

### APIs
- [OpenRouter](https://openrouter.ai/docs)
- [Brave Search](https://brave.com/search/api/)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api)

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file

---

## 🤝 Contributing

This is a personal learning project demonstrating serverless Discord bots. Feel free to:
- Fork and customize for your own bots
- Open issues for bugs
- Submit PRs for improvements
- Use as reference for your projects

---

## 👨‍💻 Author

Built with [Claude Code](https://claude.com/claude-code) by Anthropic

**Key Takeaway**: Discord bots don't need servers! Cloudflare Workers + HTTP interactions = serverless, scalable, globally distributed bots with zero infrastructure overhead.

---

**Monica AI Suite** - Demonstrating the future of Discord bot development 🤖🎵
