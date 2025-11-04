# CASIE - Context-Aware Small Intelligence on Edge

A production-ready Discord bot platform demonstrating modern serverless architecture on Cloudflare's edge network. CASIE (Context-Aware Small Intelligence on Edge) showcases how to build scalable, globally distributed Discord bots without traditional server infrastructure, using lightweight AI models running at the edge.

---

## 🎯 Overview

CASIE is a **unified Discord bot** that demonstrates best practices for building Discord bots using serverless technology. Instead of running on traditional servers, this bot runs on Cloudflare Workers - a serverless platform that executes code at 300+ edge locations worldwide.

**What makes this project unique:**
- Zero server management - deploy and forget
- Global edge deployment - sub-50ms response times worldwide
- Free tier covers most use cases - cost-effective scaling
- Production-ready patterns - OAuth, persistence, security
- Educational focus - clean code and clear architecture
- Unified architecture - single worker, multiple capabilities

---

## 🤖 Bot Commands

### AI & Conversation
- `/chat <query>` - Chat with AI assistant with conversational memory (2-hour context window)
- `/web-search <query>` - Search the web and get AI-summarized results

### Media Library
- `/videos <query>` - Unified TV library browser and episode player with natural language understanding
  - **Browse mode**: "list the available tv shows", "how many episodes of friends?", "do we have breaking bad?"
  - **Open mode**: "play friends s01e01", "open brooklyn nine nine season 1 episode 1", "play the office 3x12"
  - Intelligently routes between browsing and playback using LLM classification

### PC Control (via CASIE Bridge)
- `/pc-lock` - Lock your Windows PC with confirmation
- `/pc-restart` - Restart your Windows PC with confirmation
- `/pc-shutdown` - Shutdown your Windows PC with confirmation
- `/pc-sleep` - Put your Windows PC to sleep with confirmation

### Spotify Integration
- `/linkspotify` - Link your Spotify account (one-time setup)
- `/play <query>` - Search for tracks and play with confirmation buttons
- `/resume` - Resume or start playback
- `/pause` - Pause current playback
- `/next` - Skip to next track
- `/previous` - Go back to previous track
- `/nowplaying` - Show currently playing track with artwork and progress
- `/playlists` - Browse your personal playlists

### Utility
- `/clear` - Clear all messages in the channel (requires manage messages permission)

---

## ✨ Key Features

### Short-Term Memory (STM)
- Conversational context awareness with 2-hour memory window
- Stores last 10 message exchanges per user/channel
- Automatic conversation summarization
- Fact extraction (names, preferences)
- Graceful expiration with Cloudflare KV

### Interactive Components
- Discord button integration for search results
- Visual confirmation before actions
- Clean, modern interface

### Smart Device Management
- Automatic Spotify device discovery
- Seamless playback transfer
- Clear error messages

### Secure OAuth
- Stateless OAuth flow with HMAC-signed state
- Persistent token storage in Cloudflare KV
- Automatic token refresh
- No session storage required

### Rate Limiting
- Per-user, per-command cooldowns
- Abuse prevention
- Friendly error messages with remaining time

---

## 🏗️ Technical Architecture

### Why Cloudflare Workers?

Traditional Discord bots require always-on servers, complex infrastructure, and constant maintenance. Cloudflare Workers offers a fundamentally different approach:

**Traditional Approach:**
- Rent a VPS or use AWS EC2
- Maintain WebSocket connections 24/7
- Handle scaling, uptime, and deployments
- Pay for idle server time
- Single geographic location

**Workers Approach:**
- Serverless - no infrastructure to manage
- HTTP-based interactions (no persistent connections)
- Auto-scaling built-in
- Pay only for actual requests
- Deployed globally at 300+ locations

### How It Works

**Discord Interaction Flow:**
1. User types a command (e.g., `/chat hello`)
2. Discord sends an HTTP POST request to your Worker
3. Worker verifies the request signature (security)
4. Worker responds immediately with deferred response
5. Worker processes the command in the background
6. Worker sends the final response back to Discord
7. User sees the result

### Key Components

**Edge Computing:**
- Code runs at the nearest Cloudflare data center
- Sub-50ms latency worldwide
- No cold starts (unlike AWS Lambda)
- Automatic failover and redundancy

**Persistent Storage:**
- **Cloudflare KV** for user tokens, STM, and tunnel URLs
  - Eventually consistent key-value store
  - Globally distributed
  - Free tier: 100k reads/day, 1k writes/day
- **Cloudflare D1** for structured episode data
  - SQLite-based serverless database
  - Fast exact lookups (~28ms)
  - Free tier: 5M reads/month, 100k writes/month

**Security:**
- Ed25519 signature verification on all requests
- Encrypted secret storage
- Per-user rate limiting
- Input validation and sanitization
- Bearer token authentication for Bridge API

---

## 📊 Performance & Scalability

### Response Times

**Typical Performance:**
- Command acknowledgment: <100ms
- Simple commands (pause/next): 200-500ms
- Search commands: 1-2 seconds
- AI chat with STM: 2-4 seconds
- OAuth flow: 3-5 seconds

**Global Edge Network:**
- 300+ locations worldwide
- Automatic routing to nearest edge
- Sub-50ms latency for most users
- No geographic bottlenecks

### Cost Structure

**Free Tier Coverage:**
- 100,000 requests/day
- Unlimited bandwidth
- 100k KV reads/day
- 1k KV writes/day
- 10k AI model invocations/day

**Estimated Usage (100 active users):**
- ~700 requests/day total
- ~200 KV operations/day
- ~20 search API calls/day
- **Cost: $0/month** (within free tier)

**Scaling:**
- 1,000 users: Still free
- 10,000 users: ~$3/month
- 100,000 users: ~$30/month

---

## 🚀 Deployment

### Prerequisites

**Accounts Needed:**
1. Cloudflare account (free)
2. Discord application
3. Spotify Developer account
4. OpenRouter API key (free tier available)
5. Brave Search API key (2,000 queries/month free)

**Tools Required:**
- Node.js 18+ and npm
- Wrangler CLI (`npm install -g wrangler`)
- Git (optional, for version control)

### Quick Start

**1. Clone and Setup:**
```bash
git clone <repo>
cd casie/core
npm install
cp .env.template .env
# Edit .env with your credentials
```

**2. Configure Cloudflare:**
```bash
# Login to Cloudflare
wrangler login

# Create KV namespaces
wrangler kv namespace create STM
wrangler kv namespace create SPOTIFY_TOKENS
wrangler kv namespace create BRIDGE_KV

# Create D1 database
wrangler d1 create videos-db
wrangler d1 execute videos-db --file=schema.sql

# Update wrangler.toml with namespace IDs
```

**3. Set Secrets:**
```bash
# Upload all secrets at once
wrangler secret bulk .env

# Or set individually
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_BOT_TOKEN
# ... etc
```

**4. Deploy Worker:**
```bash
npm run deploy
```

**5. Configure Discord:**
```
Set interaction endpoint: https://<your-worker>.workers.dev/
Register commands: node register-commands.cjs
Add bot to server with OAuth URL
```

**6. Test:**
```
Try /chat in Discord
Try /linkspotify for Spotify integration
```

### Environment Variables

See [SECRETS_SETUP.md](core/SECRETS_SETUP.md) for detailed secret configuration instructions.

**Required Secrets (11 total):**
- `DISCORD_PUBLIC_KEY` - Discord app public key
- `DISCORD_BOT_TOKEN` - Discord bot token
- `APPLICATION_ID` - Discord application ID
- `OPENROUTER_API_KEY` - OpenRouter API key
- `BRAVE_API_KEY` - Brave Search API key
- `SPOTIFY_CLIENT_ID` - Spotify app client ID
- `SPOTIFY_CLIENT_SECRET` - Spotify app client secret
- `SPOTIFY_REDIRECT_URI` - OAuth callback URL
- `SPOTIFY_STATE_SECRET` - OAuth state signing secret
- `CASIE_BRIDGE_API_TOKEN` - Bridge API authentication token
- `YOUR_DISCORD_ID` - Your Discord user ID (for PC control commands)

---

## 🌉 CASIE Bridge - Local Server Tunnel

A self-contained Windows environment for running a FastAPI server locally and exposing it securely via Cloudflare Tunnel with automatic URL upload to Cloudflare KV.

### What is CASIE Bridge?

CASIE Bridge creates a secure bridge between your local development environment and the internet, allowing Discord bots to communicate with local services running on your Windows machine. Perfect for:
- Local media library access
- PC control commands (lock, restart, shutdown, sleep)
- Local development and testing
- Quick prototyping with automatic HTTPS URLs

### Features

- **FastAPI Server**: Lightweight Python web server running on `http://127.0.0.1:8000`
- **Cloudflare Tunnel**: Free HTTPS tunnel exposing your local server publicly
- **Bearer Token Auth**: Secure all endpoints with token-based authentication
- **KV URL Storage**: Automatically uploads dynamic tunnel URL to Cloudflare KV
- **Auto-start**: Configured to start automatically on Windows user login via Task Scheduler
- **Zero Config**: Runs without port forwarding or router configuration

### Available Endpoints

- **`GET /`** - Health check endpoint
- **`GET /health`** - Detailed health check with version info
- **`GET /videos`** - Get TV shows index from videos.md file (markdown)
- **`POST /open`** - Open local file with Windows default application
- **`POST /lock`** - Lock Windows PC (equivalent to Win+L)
- **`POST /restart`** - Restart Windows PC
- **`POST /shutdown`** - Shutdown Windows PC
- **`POST /sleep`** - Put Windows PC to sleep

### TV Show Management (Unified Script)

CASIE Bridge includes a unified script that handles both markdown indexing AND Cloudflare D1 database population.

**How it works:**
1. Scans your local TV directory for video files
2. Generates `videos.md` with show/season/episode information (for browse mode)
3. Populates Cloudflare D1 database with episode metadata (for open mode)
4. Uses LLM parsing to extract structured data and route between browse/open modes

**Usage:**
```bash
# Run both operations (default)
python videos.py

# Generate markdown only
python videos.py --markdown-only

# Populate D1 only
python videos.py --d1-only
```

**Configure via .env:**
```bash
TV_DIRECTORY=C:\path\to\your\TV    # Path to TV directory
D1_DATABASE_ID=your-database-id    # Cloudflare D1 database ID
```

**Architecture:**
- **Old approach**: Qdrant vector search with embeddings (~60ms+ queries)
- **New approach**: LLM parsing + D1 SQL lookups (~28ms queries)
- **Benefits**: Faster, more accurate, simpler architecture, no Docker needed

### Quick Start

**1. Install Requirements:**
```powershell
# Install Python 3.13+
winget install Python.Python.3.13

# Install cloudflared
winget install Cloudflare.cloudflared

# Install Python packages
pip install -r bridge/requirements.txt
```

**2. Generate API Token:**
```powershell
cd bridge
.\setup_api_token.ps1
```

**3. Configure Environment:**
```bash
# Edit bridge/.env
API_AUTH_TOKEN=<generated_token>
TV_DIRECTORY=C:\path\to\TV
D1_DATABASE_ID=<your_d1_id>
```

**4. Setup Auto-start:**
```powershell
.\setup_autostart.ps1
```

**5. Start Services:**
```powershell
.\casie.ps1 -Action start
```

### Manual Control

```powershell
# Start all services
.\bridge\casie.ps1 -Action start

# Stop all services
.\bridge\casie.ps1 -Action stop

# Restart services
.\bridge\casie.ps1 -Action restart

# Check status
.\bridge\casie.ps1 -Action status
```

### Directory Structure

```
bridge/
├── main.py                 # FastAPI application
├── videos.py               # Unified TV show management (markdown + D1)
├── requirements.txt        # Python dependencies
├── .env                    # Environment config (contains secrets)
├── casie.ps1               # Unified service manager
├── setup_autostart.ps1     # Configure Task Scheduler
└── setup_api_token.ps1     # Generate and configure API token
```

---

## 🔐 Security & Privacy

### Security Measures

**Authentication:**
- Ed25519 signature verification on all Discord requests
- OAuth 2.0 for Spotify integration
- HMAC-signed state parameters for stateless OAuth
- Bearer token authentication for Bridge API
- Automatic token refresh

**Data Protection:**
- Encrypted secret storage in Cloudflare
- Secure token management in KV
- No plaintext credentials
- Regular security audits

**Rate Limiting:**
- Per-user, per-command cooldowns
- API quota management
- Abuse prevention
- DDoS protection (Cloudflare)

### Privacy

**Data Collection:**
- Only stores necessary OAuth tokens
- Discord user IDs for token mapping
- Short-term conversation context (2-hour expiration)
- No message content storage beyond STM window
- No usage analytics

**Data Retention:**
- STM entries expire after 2 hours
- Spotify tokens persist until revoked
- No permanent user data storage
- Optional data deletion on request

**Third-Party Services:**
- OpenRouter (LLM processing)
- Brave Search (web search)
- Spotify (music control)
- Discord (bot platform)
- Cloudflare (infrastructure)

---

## 📁 Project Structure

```
casie/
├── core/                          # Unified Discord Bot Worker
│   ├── src/
│   │   ├── worker.ts             # Main entry point
│   │   ├── stm.ts                # Short-Term Memory system
│   │   ├── ratelimit.ts          # Rate limiting
│   │   ├── commands/             # Spotify command handlers
│   │   ├── llm/                  # Natural language processing
│   │   ├── spotify/              # Spotify API integration
│   │   └── utils/                # Helper utilities
│   ├── test/                      # Vitest tests
│   ├── wrangler.toml             # Worker configuration
│   ├── package.json              # Dependencies and scripts
│   ├── register-commands.cjs     # Command registration
│   ├── .env.template             # Environment template
│   └── SECRETS_SETUP.md          # Secret configuration guide
│
├── bridge/                        # Local Bridge Server
│   ├── main.py                   # FastAPI application
│   ├── videos.py                 # TV show management
│   ├── casie.ps1                 # Service manager
│   ├── setup_autostart.ps1       # Auto-start configuration
│   └── setup_api_token.ps1       # Token generator
│
└── CLAUDE.md                      # Development guide
```

---

## 🛠️ Development

### Running Tests

```bash
cd core
npm test
```

### Type Checking

```bash
cd core
npx tsc --noEmit
```

### Local Development

```bash
cd core
npm run dev
```

### Viewing Logs

```bash
cd core
wrangler tail --format pretty
```

---

## 📚 Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Discord Developer Portal](https://discord.com/developers/docs)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- [CLAUDE.md](CLAUDE.md) - Comprehensive development guide

---

## 📝 License

This project is a reference implementation for educational purposes. Feel free to use it as a starting point for your own projects.

---

## 🤝 Contributing

This is a personal project, but feel free to fork and adapt for your own use cases. If you find bugs or have suggestions, please open an issue.

---

**Built with ❤️ using Cloudflare Workers, TypeScript, and FastAPI**
