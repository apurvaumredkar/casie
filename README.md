# Monica - AI Bot Suite

Monica is an AI-powered bot suite running on Cloudflare Workers, designed as a collection of specialized Discord bots working together as sub-agents within a unified platform.

## 🎯 Architecture

Monica is not a single bot, but an **AI suite of bots**:
- **Monica** is the server/platform name
- Each bot is a **sub-agent** with specialized capabilities
- All bots follow the naming convention: `<name>-bot`

```
Monica (Server/Platform)
├── core-bot (AI Assistant)
└── spotify-bot (Music Control)
```

---

## 🤖 Available Bots

### 1. core-bot
AI assistant for intelligent conversations and web search.

**Commands:**
- `/ask <query>` - Chat with AI
- `/search <query>` - Web search with AI summarization

**Features:**
- LLaMA-powered responses
- Brave Search integration
- Edge computing on Cloudflare

**Directory:** `monica-core/`

---

### 2. spotify-bot
Spotify music control with AI-powered natural language interface.

**Commands:**
- `/linkspotify` - Link Spotify account
- `/spotify query:<text>` - AI-powered control (e.g., "play some jazz")
- `/play`, `/pause`, `/next`, `/previous` - Direct playback
- `/nowplaying` - Show current track
- `/playlists` - View playlists

**Features:**
- Natural language control via LLM
- OAuth 2.0 Spotify integration
- Rate limiting (10s cooldown on AI)
- In-memory token storage

**Directory:** `monica-spotify/`

---

## 📁 Project Structure

```
monica/
├── monica-core/              # Core AI assistant bot
│   ├── src/
│   │   └── worker.ts        # Main worker
│   ├── wrangler.toml        # Config (monica-core)
│   ├── package.json
│   └── .env                 # monica-core secrets
│
├── monica-spotify/           # Spotify control bot
│   ├── src/
│   │   ├── index.ts         # Main worker
│   │   ├── commands/        # Command handlers
│   │   ├── spotify/         # Spotify API & OAuth
│   │   ├── llm/             # OpenRouter integration
│   │   └── utils/           # Utilities
│   ├── wrangler.toml        # Config (monica-spotify)
│   ├── package.json
│   ├── register-commands.js # Command registration
│   └── .env                 # monica-spotify secrets
│
├── CLAUDE.md                # AI context
├── README.md                # This file
└── LICENSE
```

---

## 🚀 Quick Start

### Deploy core-bot

```bash
cd monica-core
npm install
npm run deploy
```

Worker URL: `https://core-bot.YOUR_SUBDOMAIN.workers.dev`

### Deploy spotify-bot

```bash
cd monica-spotify
npm install
npm run deploy
```

Worker URL: `https://spotify-bot.YOUR_SUBDOMAIN.workers.dev`

---

## ⚙️ Configuration

### monica-core
Required secrets:
- `DISCORD_PUBLIC_KEY` - Discord app public key
- `OPENROUTER_API_KEY` - OpenRouter API key
- `BRAVE_API_KEY` - Brave Search API key

```bash
cd monica-core
npx wrangler secret bulk .env
```

### monica-spotify
Required secrets:
- `DISCORD_PUBLIC_KEY` - Discord app public key (different from core)
- `OPENROUTER_API_KEY` - OpenRouter API key (can be same as core)
- `SPOTIFY_CLIENT_ID` - Spotify app client ID
- `SPOTIFY_CLIENT_SECRET` - Spotify app client secret
- `SPOTIFY_REDIRECT_URI` - OAuth callback URL

```bash
cd monica-spotify
npx wrangler secret bulk .env
```

---

## 🔧 Development

### Local Development

**monica-core:**
```bash
cd monica-core
npm run dev
# http://localhost:8787
```

**monica-spotify:**
```bash
cd monica-spotify
npm run dev
# http://localhost:8787
```

### View Logs

```bash
# monica-core
cd monica-core && npx wrangler tail

# monica-spotify
cd monica-spotify && npx wrangler tail
```

---

## 📊 Worker Naming Convention

All Monica bots follow this pattern:

| Bot Name | Cloudflare Worker | Discord App | Purpose |
|----------|------------------|-------------|---------|
| monica-core | `monica-core` | Monica Core | AI Assistant |
| monica-spotify | `monica-spotify` | SpotiBot | Music Control |
| monica-* | `monica-*` | * | Future bots |

This allows for:
- **Unified branding** (Monica platform)
- **Clear separation** (each bot is independent)
- **Easy scaling** (add more specialized bots)
- **Isolated deployments** (one bot doesn't affect others)

---

## 🎯 Future Sub-Agents

Monica can be extended with additional specialized bots:

- `monica-calendar` - Calendar/scheduling management
- `monica-tasks` - Task and project management
- `monica-voice` - Voice channel utilities
- `monica-moderation` - Server moderation
- `monica-analytics` - Server analytics
- Custom bots as needed

Each would be:
- Independent Cloudflare Worker
- Separate Discord application
- Isolated secrets and configuration
- Unified under "Monica" brand

---

## 🔐 Security

- **Isolated Secrets**: Each bot has its own `.env` and Cloudflare secrets
- **Signature Verification**: All bots verify Discord Ed25519 signatures
- **OAuth Security**: CSRF protection, secure token exchange
- **Rate Limiting**: AI queries have cooldown periods

---

## 💰 Cost

**Free tier covers typical usage:**
- Cloudflare Workers: Free (100k req/day per worker)
- OpenRouter LLaMA: Free
- Brave Search: Free tier (2k queries/month)
- Spotify API: Free

**Typical cost for 100 users: $0/month**

---

## 🐛 Troubleshooting

### Commands don't appear
- Wait 5-10 minutes
- Refresh Discord
- Re-run `register-commands.js` in bot directory

### Deployment fails
```bash
# Check worker name in wrangler.toml
cd monica-<name>
cat wrangler.toml | grep "^name"

# Should be: name = "monica-<name>"
```

### View specific bot logs
```bash
cd monica-<name>
npx wrangler tail
```

---

## 📚 Documentation

- OpenRouter: https://openrouter.ai/docs
- Brave Search: https://brave.com/search/api/
- Spotify: https://developer.spotify.com/documentation/web-api
- Discord: https://discord.com/developers/docs
- Cloudflare Workers: https://developers.cloudflare.com/workers

---

## 🤝 Contributing

This is a personal project demonstrating a modular Discord bot architecture. Feel free to fork and customize.

---

## 📄 License

MIT

---

**Monica AI Suite** - Specialized bots working together 🤖🎵
