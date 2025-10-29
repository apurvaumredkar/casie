# Monica Discord Bot

Monica is an AI-powered Discord bot built on Cloudflare Workers that provides intelligent assistance through slash commands. It integrates with OpenRouter's LLM API for natural language processing and Brave Search API for web search capabilities.

## Features

- **`/ask`** - Chat with an AI assistant powered by Meta's Llama 4 Scout
- **`/search`** - Search the web and get AI-summarized results
- **Edge deployment** - Runs on Cloudflare's global network for low latency
- **Secure** - Ed25519 signature verification for all Discord interactions
- **Async processing** - Deferred responses to handle Discord's 3-second timeout

## Architecture

Monica is built as a Cloudflare Worker that handles Discord webhook interactions:

1. Discord sends interaction → Worker verifies signature
2. Worker responds immediately with deferred message
3. Background processing calls external APIs
4. Follow-up message sent to Discord with results

### Tech Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **LLM Provider**: OpenRouter (Meta Llama 4 Scout)
- **Search API**: Brave Search
- **Platform**: Discord Bot

## Setup

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Discord application (Bot)
- OpenRouter API key
- Brave Search API key

### 1. Clone the Repository

```bash
git clone https://github.com/apurvaumredkar/monica.git
cd monica
npm install
```

### 2. Configure Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to Bot section and create a bot
4. Copy the Public Key from General Information
5. Go to Bot → OAuth2 → URL Generator:
   - Select `applications.commands` scope
   - Copy the generated URL and invite the bot to your server
6. Register slash commands:

```bash
# Use Discord's API or a registration script to register:
# /ask - Chat with Monica
# /search - Search the web
```

### 3. Set Environment Variables

Create a `.env` file (already gitignored):

```env
DISCORD_PUBLIC_KEY=your_discord_public_key
OPENROUTER_API_KEY=your_openrouter_api_key
BRAVE_API_KEY=your_brave_search_api_key
```

### 4. Upload Secrets to Cloudflare

```bash
# Upload all secrets at once
npx wrangler secret bulk .env

# Or upload individually
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put BRAVE_API_KEY
```

### 5. Deploy

```bash
npm run deploy
```

Your worker will be deployed and you'll get a URL like:
`https://monica.your-subdomain.workers.dev`

### 6. Configure Discord Webhook

1. Go back to Discord Developer Portal → Your Application
2. Navigate to General Information
3. Set "Interactions Endpoint URL" to your worker URL
4. Discord will verify the endpoint (must return valid signature verification)

## Development

### Local Development

```bash
npm run dev
# Worker starts on http://localhost:8787
```

For local testing with Discord, you'll need to expose your local server (e.g., using ngrok) and update the Discord webhook URL.

### Testing

```bash
npm test
```

### Type Checking

```bash
npx tsc --noEmit
```

### Viewing Logs

```bash
npx wrangler tail
```

## Commands

### `/ask <question>`

Ask Monica any question and get an AI-generated response.

**Example:**
```
/ask What is quantum computing?
```

### `/search <query>`

Search the web and get an AI-summarized response with sources.

**Example:**
```
/search latest developments in artificial intelligence
```

## Project Structure

```
monica/
├── src/
│   ├── worker.ts          # Main Discord bot worker
│   └── index.ts           # Original template (unused)
├── test/
│   ├── index.spec.ts      # Test suite
│   └── env.d.ts           # Test environment types
├── .env                   # Environment variables (gitignored)
├── wrangler.toml          # Cloudflare Worker configuration
├── tsconfig.json          # TypeScript configuration
├── package.json           # Dependencies and scripts
├── CLAUDE.md              # Claude Code guidance
└── README.md              # This file
```

## How It Works

### Discord Interaction Flow

1. User runs `/ask` or `/search` in Discord
2. Discord sends POST request to worker with signed payload
3. Worker verifies Ed25519 signature using `DISCORD_PUBLIC_KEY`
4. Worker responds with `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (type 5)
5. Worker processes request asynchronously:
   - `/ask`: Sends prompt to OpenRouter LLM
   - `/search`: Calls Brave Search → Sends results to LLM for summarization
6. Worker sends follow-up message via Discord webhook
7. Discord displays the response to the user

### Deferred Response Pattern

Discord requires responses within 3 seconds. Since external API calls can take longer:

- Worker immediately acknowledges the interaction
- Processing happens in background via `ctx.waitUntil()`
- Final response sent via Discord's webhook API

This pattern prevents timeout errors and provides a better user experience.

## Configuration

### Model Settings

The LLM configuration can be adjusted in [src/worker.ts](src/worker.ts):

```typescript
const LLM_MODEL = "meta-llama/llama-4-scout:free";
const DEFAULT_TEMPERATURE = 0.4;
```

### System Prompt

Monica's personality and behavior are defined in the `SYSTEM_PROMPT` constant in [src/worker.ts](src/worker.ts).

## Security

- All Discord interactions are verified using Ed25519 signatures
- API keys are stored as Cloudflare Worker secrets (not in code)
- `.env` file is gitignored to prevent accidental exposure
- No user data is stored or logged

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Built with [Cloudflare Workers](https://workers.cloudflare.com/)
- Powered by [OpenRouter](https://openrouter.ai/)
- Search by [Brave Search API](https://brave.com/search/api/)
- Bot platform by [Discord](https://discord.com/)

## Support

For issues, questions, or suggestions, please [open an issue](https://github.com/apurvaumredkar/monica/issues) on GitHub.

---

**Deployed at:** `https://monica.apoorv-umredkar.workers.dev`
