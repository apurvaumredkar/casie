# Setting Up Secrets for Unified CASIE Bot

After setting up the secrets, the Discord interaction endpoint will validate successfully.

## Quick Setup

1. **Copy the template**:
   ```bash
   cp .env.template .env
   ```

2. **Fill in your values in `.env`**

3. **Upload secrets to Cloudflare**:
   ```bash
   wrangler secret bulk .env
   ```

## Required Secrets

### Discord Configuration
- **DISCORD_PUBLIC_KEY**: Get from Discord Developer Portal > Your App > General Information
- **DISCORD_BOT_TOKEN**: Get from Discord Developer Portal > Your App > Bot
- **APPLICATION_ID**: Get from Discord Developer Portal > Your App > General Information > Application ID

### API Keys
- **OPENROUTER_API_KEY**: Get from [OpenRouter](https://openrouter.ai/)
- **BRAVE_API_KEY**: Get from [Brave Search API](https://brave.com/search/api/)

### Spotify Configuration
- **SPOTIFY_CLIENT_ID**: Get from [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- **SPOTIFY_CLIENT_SECRET**: Get from Spotify Developer Dashboard
- **SPOTIFY_REDIRECT_URI**: Should be `https://casie.apoorv-umredkar.workers.dev/oauth/callback`
- **SPOTIFY_STATE_SECRET**: Generate a random 64-character hex string:
  ```bash
  # On Linux/Mac
  openssl rand -hex 32

  # On Windows PowerShell
  -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  ```

### CASIE Bridge
- **CASIE_BRIDGE_API_TOKEN**: Generate a secure random token:
  ```bash
  # On Linux/Mac
  openssl rand -base64 32

  # On Windows PowerShell
  [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
  ```

### Access Control
- **YOUR_DISCORD_ID**: Your Discord user ID (for /pc-lock and other restricted commands)

## After Setting Secrets

1. **Verify secrets are set**:
   ```bash
   wrangler secret list
   ```

2. **Update Discord interaction endpoint**:
   - Go to Discord Developer Portal > Your App > General Information
   - Set **Interactions Endpoint URL** to: `https://casie.apoorv-umredkar.workers.dev/`
   - Discord will send a PING request to verify the endpoint
   - If validation fails, check that `DISCORD_PUBLIC_KEY` is correct

3. **Update Spotify redirect URI**:
   - Go to Spotify Developer Dashboard > Your App > Settings
   - Add **Redirect URI**: `https://casie.apoorv-umredkar.workers.dev/oauth/callback`

4. **Test the bot**:
   - Try `/chat hello` in Discord
   - Try `/linkspotify` to test Spotify OAuth
   - Try `/web-search test` to test web search

## Troubleshooting

### Discord Endpoint Validation Fails
- Double-check `DISCORD_PUBLIC_KEY` matches your Discord app's public key
- Ensure the worker is deployed: `wrangler deploy`
- Check worker logs: `wrangler tail`

### Spotify OAuth Fails
- Verify `SPOTIFY_REDIRECT_URI` is set correctly in both:
  - Cloudflare secrets
  - Spotify Developer Dashboard
- Check `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are correct

### Commands Not Appearing in Discord
- Run `node register-commands.cjs` to register all commands
- Wait a few minutes for Discord to propagate the changes
- Try restarting Discord client
