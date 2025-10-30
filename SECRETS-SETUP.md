# CASIE Secrets Setup Guide

## ⚠️ IMPORTANT: Secrets Required for Workers

After renaming the workers from `monica-*` to `casie-*`, all secrets need to be set again. This is why the Discord endpoint validation is failing.

---

## CASIE Core Bot Secrets

### Required Secrets:

1. **DISCORD_PUBLIC_KEY** - From Discord Developer Portal
2. **DISCORD_BOT_TOKEN** - From Discord Developer Portal
3. **OPENROUTER_API_KEY** - From OpenRouter
4. **BRAVE_API_KEY** - From Brave Search API
5. **WEATHER_API_KEY** - From weather service
6. **WEATHER_CHANNEL_ID** - Discord channel ID for weather updates
7. **CRON_SECRET_TOKEN** - Secret token for CRON endpoint

### How to Set Secrets:

```bash
cd casie-core

# 1. Discord Public Key (Required for endpoint validation!)
echo "YOUR_CORE_BOT_PUBLIC_KEY" | npx wrangler secret put DISCORD_PUBLIC_KEY

# 2. Discord Bot Token
echo "YOUR_CORE_BOT_TOKEN" | npx wrangler secret put DISCORD_BOT_TOKEN

# 3. OpenRouter API Key
echo "YOUR_OPENROUTER_KEY" | npx wrangler secret put OPENROUTER_API_KEY

# 4. Brave Search API Key
echo "YOUR_BRAVE_KEY" | npx wrangler secret put BRAVE_API_KEY

# 5. Weather API Key
echo "YOUR_WEATHER_KEY" | npx wrangler secret put WEATHER_API_KEY

# 6. Weather Channel ID
echo "YOUR_DISCORD_CHANNEL_ID" | npx wrangler secret put WEATHER_CHANNEL_ID

# 7. CRON Secret Token
echo "YOUR_RANDOM_SECRET" | npx wrangler secret put CRON_SECRET_TOKEN
```

### Where to Get These Values:

**DISCORD_PUBLIC_KEY** (Most Important!)
- Go to https://discord.com/developers/applications
- Select your **Core Bot** application
- Go to "General Information"
- Copy the "Public Key" (64-character hex string)

**DISCORD_BOT_TOKEN**
- Same Discord application
- Go to "Bot" section
- Click "Reset Token" or copy existing token
- Format: starts with your bot's user ID

**OPENROUTER_API_KEY**
- Go to https://openrouter.ai/keys
- Create an API key
- Can be shared between both workers

**BRAVE_API_KEY**
- Go to https://brave.com/search/api/
- Sign up for API access
- Copy your subscription key

**WEATHER_API_KEY**
- Go to your weather service provider (e.g., OpenWeatherMap)
- Get your API key

**WEATHER_CHANNEL_ID**
- Right-click on the Discord channel where you want weather updates
- Click "Copy Channel ID"

**CRON_SECRET_TOKEN**
- Generate a random secure string:
  ```bash
  openssl rand -hex 32
  ```

---

## CASIE Spotify Bot Secrets

### Required Secrets:

1. **DISCORD_PUBLIC_KEY** - From Discord Developer Portal (DIFFERENT from Core Bot!)
2. **DISCORD_BOT_TOKEN** - From Discord Developer Portal
3. **SPOTIFY_CLIENT_ID** - From Spotify Developer Dashboard
4. **SPOTIFY_CLIENT_SECRET** - From Spotify Developer Dashboard
5. **SPOTIFY_REDIRECT_URI** - Your worker callback URL
6. **OPENROUTER_API_KEY** - From OpenRouter (can reuse from Core Bot)

### How to Set Secrets:

```bash
cd casie-spotify

# 1. Discord Public Key (MUST BE FROM SPOTIFY BOT APP!)
echo "YOUR_SPOTIFY_BOT_PUBLIC_KEY" | npx wrangler secret put DISCORD_PUBLIC_KEY

# 2. Discord Bot Token
echo "YOUR_SPOTIFY_BOT_TOKEN" | npx wrangler secret put DISCORD_BOT_TOKEN

# 3. Spotify Client ID
echo "YOUR_SPOTIFY_CLIENT_ID" | npx wrangler secret put SPOTIFY_CLIENT_ID

# 4. Spotify Client Secret
echo "YOUR_SPOTIFY_CLIENT_SECRET" | npx wrangler secret put SPOTIFY_CLIENT_SECRET

# 5. Spotify Redirect URI
echo "https://casie-spotify.apoorv-umredkar.workers.dev/oauth/callback" | npx wrangler secret put SPOTIFY_REDIRECT_URI

# 6. OpenRouter API Key (same as Core Bot)
echo "YOUR_OPENROUTER_KEY" | npx wrangler secret put OPENROUTER_API_KEY
```

### Where to Get These Values:

**DISCORD_PUBLIC_KEY** (⚠️ DIFFERENT from Core Bot!)
- Go to https://discord.com/developers/applications
- Select your **Spotify Bot** application (NOT Core Bot!)
- Go to "General Information"
- Copy the "Public Key"

**DISCORD_BOT_TOKEN**
- Same Spotify Bot application
- Go to "Bot" section
- Copy the token

**SPOTIFY_CLIENT_ID & SPOTIFY_CLIENT_SECRET**
- Go to https://developer.spotify.com/dashboard
- Select or create your app
- Go to "Settings"
- Copy Client ID and Client Secret

**SPOTIFY_REDIRECT_URI**
- Use: `https://casie-spotify.apoorv-umredkar.workers.dev/oauth/callback`
- Also add this to Spotify Dashboard → Settings → Redirect URIs

---

## Quick Setup Commands

### If you have all values ready, use this:

**Core Bot:**
```bash
cd casie-core
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_BOT_TOKEN
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put BRAVE_API_KEY
npx wrangler secret put WEATHER_API_KEY
npx wrangler secret put WEATHER_CHANNEL_ID
npx wrangler secret put CRON_SECRET_TOKEN
```

**Spotify Bot:**
```bash
cd casie-spotify
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_BOT_TOKEN
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET
npx wrangler secret put SPOTIFY_REDIRECT_URI
npx wrangler secret put OPENROUTER_API_KEY
```

Each command will prompt you to paste the value.

---

## Verification

After setting secrets, verify they're set:

```bash
cd casie-core
npx wrangler secret list

cd casie-spotify
npx wrangler secret list
```

You should see all secret names listed (values are hidden for security).

---

## Discord Endpoint Validation

Once `DISCORD_PUBLIC_KEY` is set, validation should work:

1. Go to Discord Developer Portal
2. Select your bot application
3. Go to General Information
4. Set Interactions Endpoint URL:
   - Core Bot: `https://casie-core.apoorv-umredkar.workers.dev`
   - Spotify Bot: `https://casie-spotify.apoorv-umredkar.workers.dev`
5. Click "Save Changes"
6. Discord will send a PING request
7. Should see ✅ if validation succeeds

---

## Troubleshooting

**"Invalid request signature"**
- Check that `DISCORD_PUBLIC_KEY` matches the Discord app
- Make sure you're using the correct app (Core vs Spotify)
- Public key should be exactly 64 hexadecimal characters

**"Missing signature"**
- Discord is not sending requests (check URL)
- Worker is not receiving the request

**Still failing?**
- Run `npx wrangler tail` in the worker directory
- Try to save the endpoint in Discord
- Watch the logs to see what's happening

---

## Important Notes

⚠️ **Core Bot and Spotify Bot have DIFFERENT Discord applications**
- Different Application IDs
- Different Public Keys
- Different Bot Tokens
- DO NOT mix them up!

✅ **These can be shared:**
- OPENROUTER_API_KEY (same for both)
- BRAVE_API_KEY (only used by Core Bot)

🔒 **Never commit secrets to git**
- Secrets are stored in Cloudflare
- They're encrypted and secure
- Use `.env` files locally (already in .gitignore)
