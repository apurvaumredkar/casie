# Monica - AI Bot Suite on Cloudflare Workers

A production-ready Discord bot platform demonstrating modern serverless architecture on Cloudflare's edge network. This project showcases how to build scalable, globally distributed Discord bots without traditional server infrastructure.

---

## 🎯 Overview

Monica is a **dual-bot platform** that demonstrates best practices for building Discord bots using serverless technology. Instead of running on traditional servers, these bots run on Cloudflare Workers - a serverless platform that executes code at 300+ edge locations worldwide.

**What makes this project unique:**
- Zero server management - deploy and forget
- Global edge deployment - sub-50ms response times worldwide
- Free tier covers most use cases - cost-effective scaling
- Production-ready patterns - OAuth, persistence, security
- Educational focus - clean code and clear architecture

---

## 🤖 The Two Bots

### Core Bot - AI Assistant

A general-purpose AI assistant for conversations and web research.

**Commands:**
- `/ask` - Chat with an AI assistant powered by large language models
- `/web-search` - Search the web and get AI-summarized results

**Features:**
- Natural language conversations with context awareness
- Web search powered by Brave Search API
- Intelligent result summarization
- Private responses (only visible to you)

**Use Cases:**
- Quick information lookup
- Research assistance
- General Q&A
- Learning and education

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

## 🎓 Educational Value

### What You'll Learn

**Serverless Architecture:**
- Edge computing concepts
- Stateless design patterns
- Event-driven architecture
- Scalability best practices

**OAuth 2.0 Implementation:**
- Authorization code flow
- Token management
- Refresh token handling
- Stateless state management

**Discord Bot Development:**
- Slash command implementation
- Interaction handling
- Message components (buttons)
- Webhook patterns

**API Integration:**
- RESTful API design
- Authentication patterns
- Error handling
- Rate limiting

**LLM Integration:**
- Prompt engineering
- Intent parsing
- Entity extraction
- Agentic workflows

### Use Cases

**Personal Projects:**
- Learn serverless development
- Build your own Discord bots
- Experiment with LLM integration
- Practice API integration

**Educational:**
- Teach web development
- Demonstrate cloud architecture
- Show OAuth implementation
- Study production patterns

**Professional:**
- Reference architecture
- Code quality examples
- Deployment patterns
- Security best practices

---

## 🔧 Customization

### Extending the Platform

**Add New Commands:**
- Follow modular command structure
- Implement handler functions
- Register with Discord
- Deploy and test

**Integrate New APIs:**
- Add API client modules
- Implement error handling
- Update environment variables
- Test thoroughly

**Create New Bots:**
- Clone bot template
- Customize commands
- Deploy as separate Worker
- Maintain isolation

**Modify Behavior:**
- Adjust LLM prompts
- Change response formats
- Update rate limits
- Customize UI elements

### Configuration Options

**Core Bot:**
- LLM model selection
- Search result count
- Response formatting
- Timeout settings

**Spotify Bot:**
- Natural language sensitivity
- Search result limits
- Retry attempt count
- Rate limit cooldowns

---

## 🐛 Troubleshooting

### Common Issues

**Commands Not Appearing:**
- Wait 5-10 minutes for Discord sync
- Re-run command registration script
- Check application permissions
- Verify bot invite scopes

**"Bot is Offline" in Discord:**
- Worker not deployed properly
- Interaction endpoint URL incorrect
- Signature verification failing
- Check Cloudflare dashboard logs

**Spotify "No Device Found":**
- Open Spotify on any device
- Play a song to activate device
- Use Spotify Web Player
- Check device connection

**OAuth "Invalid State" Error:**
- Try linking again
- Clear browser cookies
- Check Worker deployment
- Verify KV namespace setup

### Getting Help

**Check Logs:**
- Cloudflare Workers dashboard
- Real-time log streaming
- Error tracking
- Performance metrics

**Debug Mode:**
- Enable verbose logging
- Test in development server
- Use Discord test servers
- Check API responses

---

## 📈 Roadmap & Future Features

### Planned Enhancements

**Core Bot:**
- Conversation history
- Multi-turn context
- Image generation support
- File analysis capabilities

**Spotify Bot:**
- Collaborative playlists
- Listening history
- Music recommendations
- Party mode for servers

**Platform:**
- Additional bot types
- Shared utilities package
- Admin dashboard
- Analytics integration

### Community Ideas

**Calendar Bot:**
- Event scheduling
- Reminders
- Google Calendar sync
- Timezone handling

**Task Bot:**
- Todo list management
- Project tracking
- Team collaboration
- Progress reporting

**Voice Bot:**
- Voice channel utilities
- Audio playback
- Voice commands
- Music streaming

---

## 🤝 Contributing

This project welcomes contributions from developers of all skill levels.

**Ways to Contribute:**
- Report bugs and issues
- Suggest new features
- Improve documentation
- Submit code improvements
- Share usage experiences

**Development:**
- Fork the repository
- Create feature branches
- Write clear commit messages
- Test thoroughly before submitting
- Follow existing code style

---

## 📄 License

MIT License - Free to use, modify, and distribute.

This project is open source and available for educational and commercial use. No attribution required, but always appreciated!

---

## 🙏 Acknowledgments

Built with modern technologies:
- **Cloudflare Workers** - Serverless edge platform
- **Discord API** - Bot interaction framework
- **Spotify Web API** - Music streaming integration
- **OpenRouter** - LLM access platform
- **Brave Search** - Web search API
- **TypeScript** - Type-safe development

Special thanks to the developer community for feedback and support.

---

## 📚 Resources

**Learning More:**
- Cloudflare Workers documentation
- Discord developer portal
- Spotify developer docs
- OAuth 2.0 specification
- Serverless architecture guides

**Related Projects:**
- Discord bot frameworks
- Serverless Discord bots
- Music bot alternatives
- LLM integration examples

---

**Monica** - Demonstrating the future of Discord bot development through serverless edge computing 🤖🎵

*A modern approach to building scalable, cost-effective Discord bots without traditional server infrastructure.*
