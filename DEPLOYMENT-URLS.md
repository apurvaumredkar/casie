# CASIE Deployment URLs

## Worker URLs

### CASIE Core Bot
- **Worker URL**: https://casie-core.apoorv-umredkar.workers.dev
- **Health Check**: Returns "CASIE is running on Discord"
- **Version**: c097aa01-5145-4991-be77-950394bfd850

### CASIE Spotify Bot
- **Worker URL**: https://casie-spotify.apoorv-umredkar.workers.dev
- **Health Check**: https://casie-spotify.apoorv-umredkar.workers.dev/health
- **Version**: 47a27089-824d-4a1a-9915-77c6d4fef47b

---

## Required Configuration Updates

### 1. Discord Developer Portal - Core Bot

Go to: https://discord.com/developers/applications

**Update Interactions Endpoint URL:**
```
https://casie-core.apoorv-umredkar.workers.dev/interactions
```

**Steps:**
1. Select your Core Bot application
2. Go to "General Information"
3. Find "Interactions Endpoint URL"
4. Update to the URL above
5. Click "Save Changes"

### 2. Discord Developer Portal - Spotify Bot

**Update Interactions Endpoint URL:**
```
https://casie-spotify.apoorv-umredkar.workers.dev/interactions
```

**Steps:**
1. Select your Spotify Bot application
2. Go to "General Information"
3. Find "Interactions Endpoint URL"
4. Update to the URL above
5. Click "Save Changes"

### 3. Spotify Developer Dashboard

Go to: https://developer.spotify.com/dashboard

**Update Redirect URI:**
```
https://casie-spotify.apoorv-umredkar.workers.dev/oauth/callback
```

**Steps:**
1. Select your Spotify application
2. Go to "Settings"
3. Find "Redirect URIs"
4. Add/Update the URL above
5. Click "Save"

### 4. Cloudflare Worker Secrets - Spotify Bot

The Spotify redirect URI also needs to be updated in the worker secrets:

```bash
cd casie-spotify
echo "https://casie-spotify.apoorv-umredkar.workers.dev/oauth/callback" | npx wrangler secret put SPOTIFY_REDIRECT_URI
```

### 5. GitHub Actions (Optional)

The weather CRON workflow in `.github/workflows/weather-cron.yml` is already configured with the correct URL:
```
https://casie-core.apoorv-umredkar.workers.dev/cron/weather
```

No changes needed - this was already updated during the rebranding.

---

## Testing Checklist

After updating all configurations:

- [ ] Test Core Bot `/ask` command in Discord
- [ ] Test Core Bot `/web-search` command in Discord
- [ ] Test Core Bot `/weather` command in Discord
- [ ] Test Spotify Bot `/linkspotify` command (should redirect to Spotify OAuth)
- [ ] Complete Spotify OAuth flow
- [ ] Test Spotify Bot `/spotify` command with natural language
- [ ] Test Spotify Bot playback controls
- [ ] Verify GitHub Actions CRON runs successfully

---

## Old URLs (Now Deprecated)

These URLs are no longer in use:
- ~~https://monica-core.apoorv-umredkar.workers.dev~~
- ~~https://monica-spotify.apoorv-umredkar.workers.dev~~

The old workers should be deleted from Cloudflare dashboard after confirming the new ones work correctly.

---

**Deployment Date**: 2025-10-30
**Deployed By**: Claude Code
