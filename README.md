# CASIE - Context-Aware Small Intelligence on Edge

A production-ready Discord bot platform demonstrating modern serverless architecture on Cloudflare's edge network. CASIE (Context-Aware Small Intelligence on Edge) showcases how to build scalable, globally distributed Discord bots without traditional server infrastructure, using lightweight AI models running at the edge.

---

## 🎯 Overview

CASIE is a **dual-bot platform** that demonstrates best practices for building Discord bots using serverless technology. Instead of running on traditional servers, these bots run on Cloudflare Workers - a serverless platform that executes code at 300+ edge locations worldwide.

**What makes this project unique:**
- Zero server management - deploy and forget
- Global edge deployment - sub-50ms response times worldwide
- Free tier covers most use cases - cost-effective scaling
- Production-ready patterns - OAuth, persistence, security
- Educational focus - clean code and clear architecture

---

## 🤖 The Two Bots

### Core Bot - AI Assistant

A general-purpose AI assistant for conversations, web research, and weather updates.

**Commands:**

*AI Chat & Search:*
- `/ask <query>` - Chat with an AI assistant powered by large language models
- `/web-search <query>` - Search the web and get AI-summarized results

*Weather:*
- `/weather [location]` - Get current weather information
  - Optional location parameter (defaults to your configured location)
  - Examples: "Buffalo", "New York", "Tokyo"

*Utility:*
- `/clear` - Clear all messages in the channel (requires manage messages permission)

**Features:**
- Natural language conversations with context awareness
- Web search powered by Brave Search API with intelligent summarization
- Real-time weather updates with conversational AI summaries
- Automated daily weather updates via GitHub Actions CRON
- Private responses (only visible to you)

**Use Cases:**
- Quick information lookup and research
- Daily weather briefings
- General Q&A and learning
- Channel maintenance and cleanup

---

### Spotify Bot - Music Control

Full-featured Spotify integration with natural language understanding.

**Commands:**

*Natural Language Control:*
- `/spotify` - Control Spotify with plain English
  - "play some jazz"
  - "skip to next song"
  - "pause the music"
  - "play paper rings by taylor swift"

*Direct Search:*
- `/play <query>` - Search for tracks and play with confirmation buttons

*Playback Controls:*
- `/resume` - Resume or start playback
- `/pause` - Pause current playback
- `/next` - Skip to next track
- `/previous` - Go back to previous track

*Discovery:*
- `/nowplaying` - Show currently playing track with artwork and progress
- `/playlists` - Browse your personal playlists

*Account Management:*
- `/linkspotify` - Connect your Spotify account (one-time setup)

**Features:**

**Smart Natural Language Processing:**
- Understands complex queries like "play that song by taylor swift from lover album"
- Parses intents: play, pause, skip, search, discover
- Extracts entities: track names, artists, albums, genres, playlists
- Handles ambiguous requests with intelligent fallbacks

**Interactive Search:**
- Shows search results with track details
- Provides "Play" and "Cancel" buttons for confirmation
- Displays album artwork and artist information
- Includes direct Spotify links

**Intelligent Playback:**
- Automatically finds and activates available devices
- Handles multiple device scenarios gracefully
- Provides clear feedback for all actions
- Supports all standard playback controls

**Discovery Features:**
- List songs in any playlist
- Browse albums by artist
- View album tracklists with durations
- Filter user-created vs followed playlists

**Robust OAuth:**
- Secure Spotify account linking
- Persistent token storage (survives restarts)
- Automatic token refresh
- Session management with KV storage

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
1. User types a command (e.g., `/play jazz`)
2. Discord sends an HTTP POST request to your Worker
3. Worker verifies the request signature (security)
4. Worker responds immediately ("processing...")
5. Worker processes the command in the background
6. Worker sends the final response back to Discord
7. User sees the result

**Key Components:**

**Edge Computing:**
- Code runs at the nearest Cloudflare data center
- Sub-50ms latency worldwide
- No cold starts (unlike AWS Lambda)
- Automatic failover and redundancy

**Persistent Storage:**
- Cloudflare KV for user tokens and preferences
- Eventually consistent key-value store
- Globally distributed
- Free tier: 100k reads/day, 1k writes/day

**Stateless OAuth:**
- Cryptographically signed state parameters
- No session storage required
- Survives Worker restarts
- CSRF protection included

**Security:**
- Ed25519 signature verification on all requests
- Encrypted secret storage
- Per-user rate limiting
- Input validation and sanitization

---

## ✨ Key Features

### Natural Language Understanding

The Spotify bot uses LLM technology to understand complex music requests:

**Entity Extraction:**
- Track names: "paper rings"
- Artists: "taylor swift"
- Albums: "lover"
- Genres: "jazz", "rock", "classical"
- Playlists: "discover weekly"

**Intent Recognition:**
- Playback control: play, pause, skip
- Search queries: find and play music
- Discovery: list playlists, albums, tracks
- Ambiguous handling: smart fallbacks

**Multi-turn Conversations:**
- Agentic loop with retry logic
- Handles failures gracefully
- Up to 3 attempts for complex queries
- Learns from errors

### Interactive Components

Discord button integration for better user experience:

**Search Results:**
- Shows top matching track
- Display track, artist, and album
- Includes Spotify link
- Green "Play" button
- Red "Cancel" button

**Benefits:**
- Visual confirmation before playing
- Prevents accidental playback
- Better for browsing multiple results
- Cleaner interface

### Smart Device Management

Automatic device discovery and activation:

**Device Handling:**
- Finds all available Spotify devices
- Activates inactive devices automatically
- Transfers playback seamlessly
- Provides clear error messages

**Supported Devices:**
- Desktop applications (Windows, Mac, Linux)
- Mobile apps (iOS, Android)
- Web player
- Spotify Connect devices
- Smart speakers

### Playlist Discovery

Advanced playlist and album browsing:

**List Playlist Tracks:**
- Shows first 15 songs
- Includes track names and artists
- Displays total track count
- Direct Spotify link

**Browse Artist Albums:**
- Shows all albums by artist
- Includes release years
- Sorted by date
- Album count displayed

**View Album Tracks:**
- Complete tracklist
- Track durations
- Includes featured artists
- Direct album link

---

## 📊 Performance & Scalability

### Response Times

**Typical Performance:**
- Command acknowledgment: <100ms
- Simple commands (pause/next): 200-500ms
- Search commands: 1-2 seconds
- Natural language processing: 2-4 seconds
- OAuth flow: 3-5 seconds

**Global Edge Network:**
- 300+ locations worldwide
- Automatic routing to nearest edge
- Sub-50ms latency for most users
- No geographic bottlenecks

### Cost Structure

**Free Tier Coverage (per bot):**
- 100,000 requests/day
- Unlimited bandwidth
- 100k KV reads/day
- 1k KV writes/day

**Estimated Usage (100 active users):**
- ~700 requests/day total
- ~200 KV operations/day
- ~20 search API calls/day
- **Cost: $0/month** (within free tier)

**Scaling:**
- 1,000 users: Still free
- 10,000 users: ~$3/month
- 100,000 users: ~$30/month

### Reliability

**High Availability:**
- 99.99%+ uptime (Cloudflare SLA)
- Automatic failover
- No single point of failure
- Zero-downtime deployments

**Error Handling:**
- Graceful degradation
- Automatic retries
- Clear error messages
- Comprehensive logging

---

## 🚀 Deployment

### Prerequisites

**Accounts Needed:**
1. Cloudflare account (free)
2. Two Discord applications (one per bot)
3. Spotify Developer account (for Spotify bot)
4. OpenRouter API key (free tier available)
5. Brave Search API key (2,000 queries/month free)

**Tools Required:**
- Node.js 18+ and npm
- Wrangler CLI (`npm install -g wrangler`)
- Git (optional, for version control)

### Quick Start

**1. Clone and Setup:**
```
Install dependencies for both bots
Configure environment variables
Set up Cloudflare KV namespace (Spotify bot only)
```

**2. Deploy Workers:**
```
Deploy Core Bot → Get worker URL
Deploy Spotify Bot → Get worker URL
```

**3. Configure Discord:**
```
Set interaction endpoint URLs
Generate OAuth invite links
Add bots to your server
```

**4. Register Commands:**
```
Run registration scripts
Wait for Discord sync (5-10 minutes)
Commands appear in Discord
```

**5. Test:**
```
Try /ask in Discord
Try /play with Spotify bot
Link Spotify account with /linkspotify
```

### Environment Setup

**Core Bot requires:**
- Discord application credentials
- OpenRouter API key
- Brave Search API key

**Spotify Bot requires:**
- Discord application credentials
- Spotify application credentials
- OpenRouter API key
- Cloudflare KV namespace ID

All sensitive credentials are stored securely in Cloudflare's secret management system, never in code or configuration files.

---

## 🔐 Security & Privacy

### Security Measures

**Authentication:**
- Ed25519 signature verification on all Discord requests
- OAuth 2.0 for Spotify integration
- HMAC-signed state parameters
- Automatic token refresh

**Data Protection:**
- Encrypted secret storage
- Secure token management
- No plaintext credentials
- Regular security audits

**Rate Limiting:**
- Per-user cooldowns
- API quota management
- Abuse prevention
- DDoS protection (Cloudflare)

### Privacy

**Data Collection:**
- Only stores necessary OAuth tokens
- Discord user IDs for token mapping
- No message content storage
- No usage analytics

**Data Retention:**
- Tokens expire after 30 days of inactivity
- No permanent user data storage
- Optional data deletion on request

**Third-Party Services:**
- OpenRouter (LLM processing)
- Brave Search (web search)
- Spotify (music control)
- Discord (bot platform)

---

