# Monica Discord Bot

An AI-powered Discord bot built on Cloudflare Workers that demonstrates how to integrate LLM capabilities and web search into Discord slash commands. This project serves as a learning resource for building serverless Discord bots with TypeScript.

## Features

- **`/ask`** - Direct LLM chat using OpenRouter API
- **`/search`** - Web search with AI-powered summarization via Brave Search API
- **Deferred responses** - Handles Discord's 3-second timeout with async processing
- **Signature verification** - Secure Discord webhook validation using Ed25519
- **Edge deployment** - Runs globally on Cloudflare's network

## Architecture Overview

This bot uses a deferred response pattern to handle long-running API calls:

1. Discord sends webhook interaction
2. Worker verifies Ed25519 signature
3. Worker responds immediately with deferred acknowledgment
4. Background processing calls external APIs
5. Follow-up message sent via Discord webhook

**Tech Stack:** TypeScript, Cloudflare Workers, OpenRouter API, Brave Search API

## Setup

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Discord application (Bot)
- OpenRouter API key
- Brave Search API key

### 1. Clone and Install

```bash
git clone <your-repo-url>
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

You'll receive a worker URL (e.g., `https://your-worker.workers.dev`)

### 6. Configure Discord Webhook

1. Return to Discord Developer Portal → Your Application
2. Navigate to General Information
3. Set "Interactions Endpoint URL" to your worker URL
4. Discord will verify the endpoint automatically

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

## Usage

### `/ask <question>`

Direct chat with the LLM. Example:
```
/ask What is quantum computing?
```

### `/search <query>`

Web search with AI-powered summary. Example:
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

**Discord Interaction Flow:**

1. User runs `/ask` or `/search` command
2. Discord sends signed POST request to worker
3. Worker verifies Ed25519 signature
4. Worker responds with deferred acknowledgment (type 5)
5. Background processing via `ctx.waitUntil()`:
   - `/ask`: Calls OpenRouter LLM
   - `/search`: Calls Brave Search → LLM summarization
6. Follow-up message sent via Discord webhook

**Key Concept - Deferred Response Pattern:**

Discord requires responses within 3 seconds. External API calls often take longer. The solution:
- Immediately acknowledge with a deferred response
- Process asynchronously in the background
- Send the actual result via webhook when ready

This pattern is essential for any Discord bot making external API calls.

## Configuration

**LLM Settings** ([src/worker.ts](src/worker.ts)):
```typescript
const LLM_MODEL = "meta-llama/llama-4-scout:free";
const DEFAULT_TEMPERATURE = 0.4;
```

**System Prompt:** Customize the bot's personality in the `SYSTEM_PROMPT` constant.

## Security Notes

- Discord interactions verified with Ed25519 signatures
- API keys stored as Cloudflare secrets (never in code)
- No user data stored or logged

## Learning Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Discord Interactions Guide](https://discord.com/developers/docs/interactions/receiving-and-responding)
- [OpenRouter API](https://openrouter.ai/docs)
- [Brave Search API](https://brave.com/search/api/)

## License

MIT License - Feel free to use this project for learning and building your own Discord bots.
