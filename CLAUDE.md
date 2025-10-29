# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Monica** is a Discord bot built as a **Cloudflare Workers** application. It provides AI-powered assistance through Discord slash commands, integrating with OpenRouter's LLM API and Brave Search API. The project runs on Cloudflare's edge network and uses TypeScript with strict type checking.

## Architecture

### Worker Structure
- **Entry Point**: [src/worker.ts](src/worker.ts) - Main Discord bot worker
- **Handler Pattern**: The worker implements a `fetch` handler that receives `(request, env, ctx)` parameters
  - `request`: The incoming HTTP request (Discord webhook interactions)
  - `env`: Environment bindings containing API keys (DISCORD_PUBLIC_KEY, OPENROUTER_API_KEY, BRAVE_API_KEY)
  - `ctx`: Execution context for async operations like `ctx.waitUntil()`

### Discord Bot Commands
The bot implements two slash commands:

1. **`/ask`** - Direct LLM chat
   - User input → OpenRouter LLM → Response
   - Uses deferred response pattern to avoid Discord's 3-second timeout
   - Model: `meta-llama/llama-4-scout:free`

2. **`/search`** - Web search with AI summarization
   - User query → Brave Search API → OpenRouter LLM (summarization) → Response
   - Returns top 5 search results summarized into a concise response
   - Also uses deferred response pattern

### Deferred Response Pattern
**Critical**: Discord requires responses within 3 seconds. This worker uses:
- Immediate acknowledgment with `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (type 5)
- Background processing with `ctx.waitUntil()`
- Follow-up message sent via Discord's webhook API after processing completes

This pattern is implemented in:
- `handleAskDeferred()` - Processes `/ask` command asynchronously
- `handleSearchDeferred()` - Processes `/search` command asynchronously
- `sendFollowup()` - Sends the actual response via webhook

### Security
- **Discord Signature Verification**: All requests verify Ed25519 signatures using `verifyDiscordRequest()`
- **API Keys**: Stored as Cloudflare Worker secrets (not in code)

### Type System
- **Configuration Types**: [worker-configuration.d.ts](worker-configuration.d.ts) - Auto-generated type definitions
- **Env Interface**: Defines the three required environment variables:
  - `DISCORD_PUBLIC_KEY`: Discord application public key for signature verification
  - `OPENROUTER_API_KEY`: OpenRouter API key for LLM access
  - `BRAVE_API_KEY`: Brave Search API subscription token

### Configuration
- **Worker Config**: [wrangler.toml](wrangler.toml) - Primary configuration for deployment
  - `main`: Points to src/worker.ts as the entry point
  - `compatibility_date`: Defines the Cloudflare Workers runtime version
  - Secrets are managed separately via `wrangler secret` commands

## Development Commands

### Running the Worker
```bash
npm run dev        # Start local development server on http://localhost:8787
npm start          # Alias for npm run dev
```

### Testing
```bash
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

### Deployment
```bash
npm run deploy     # Deploy to Cloudflare Workers
```

### Type Generation
```bash
npm run cf-typegen # Regenerate worker-configuration.d.ts after changing wrangler.toml
```

### Managing Secrets
```bash
# Set individual secrets
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put OPENROUTER_API_KEY
wrangler secret put BRAVE_API_KEY

# Bulk upload from .env file
wrangler secret bulk .env
```

## Key Patterns

### Discord Interaction Flow
1. Discord sends POST request with interaction payload
2. Worker verifies Ed25519 signature
3. Worker immediately responds with deferred message (type 5)
4. Background processing via `ctx.waitUntil()`:
   - Call external APIs (Brave/OpenRouter)
   - Send follow-up message via Discord webhook
5. Discord displays the follow-up as the bot's response

### Adding New Commands
To add a new Discord slash command:
1. Register the command in Discord Developer Portal
2. Add case in the switch statement in [src/worker.ts:110-119](src/worker.ts#L110-L119)
3. Create a deferred handler function (e.g., `handleNewCommandDeferred`)
4. Use `ctx.waitUntil()` to process asynchronously
5. Call `sendFollowup()` to send the response

### External API Integration
- **Brave Search**: Returns top 5 web results with title, description, URL
- **OpenRouter**: Uses `meta-llama/llama-4-scout:free` model
  - Temperature: 0.4
  - Max tokens: 800 for `/ask`, 600 for `/search` summarization
- Always handle API errors gracefully with try-catch and user-friendly messages

### TypeScript Configuration
- The project uses strict mode with `isolatedModules: true`
- Module resolution is set to "Bundler" (modern bundler-aware resolution)
- JSX is configured for React (though not currently used)
- Tests are excluded from the main compilation

### Important Notes
- Never respond synchronously to long-running operations (>3 seconds)
- Always use deferred responses for API calls
- Discord webhook tokens are single-use and expire after 15 minutes
