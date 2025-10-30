# Discord Interaction Endpoint Troubleshooting

## Issue: "Interaction endpoint URL validation failed"

### Quick Fix - Use Root Path

Discord validates interaction endpoints by sending a PING request. Both CASIE workers are configured to handle interactions on **any path**, but it's recommended to use the **root path** for Discord validation.

### ✅ Correct Endpoint URLs

**For CASIE Core Bot:**
```
https://casie-core.apoorv-umredkar.workers.dev
```
(No `/interactions` suffix needed)

**For CASIE Spotify Bot:**
```
https://casie-spotify.apoorv-umredkar.workers.dev
```
(No `/interactions` suffix needed)

### Why the Validation Might Fail

1. **Wrong Public Key**: Make sure you're using the correct Discord Application's public key
   - Core Bot and Spotify Bot have **different** application IDs and public keys
   - Don't mix them up!

2. **Secrets Not Set**: Check that `DISCORD_PUBLIC_KEY` secret is set for the worker:
   ```bash
   cd casie-core  # or casie-spotify
   npx wrangler secret list
   ```

3. **Wrong Discord App**: Make sure you're configuring the endpoint in the correct Discord application

### Step-by-Step Validation Process

#### For CASIE Core Bot:

1. **Get Your Discord Public Key**
   - Go to https://discord.com/developers/applications
   - Select your **Core Bot** application
   - Go to "General Information"
   - Copy the "Public Key"

2. **Verify Secret is Set**
   ```bash
   cd casie-core
   npx wrangler secret list
   ```
   Should show `DISCORD_PUBLIC_KEY` in the list

3. **If Not Set, Add It**
   ```bash
   cd casie-core
   npx wrangler secret put DISCORD_PUBLIC_KEY
   # Paste your public key when prompted
   ```

4. **Set Interactions Endpoint URL**
   - In Discord Developer Portal → Your Core Bot App → General Information
   - Set "Interactions Endpoint URL" to:
     ```
     https://casie-core.apoorv-umredkar.workers.dev
     ```
   - Click "Save Changes"
   - Discord will send a PING request to validate

#### For CASIE Spotify Bot:

Follow the same steps but:
- Use the **Spotify Bot** application in Discord Developer Portal
- Use the **Spotify Bot's** public key (different from Core Bot!)
- Set endpoint to:
  ```
  https://casie-spotify.apoorv-umredkar.workers.dev
  ```

### Testing the Endpoint

You can test if the worker is receiving requests:

```bash
# Test Core Bot (should return "CASIE is running on Discord")
curl https://casie-core.apoorv-umredkar.workers.dev

# Test Spotify Bot (should return health check)
curl https://casie-spotify.apoorv-umredkar.workers.dev/health
```

### Common Mistakes

❌ **Don't add `/interactions` to the URL** - The worker handles it on the root path
❌ **Don't use the same public key for both bots** - Each Discord app has its own key
❌ **Don't skip setting the secret** - The worker needs `DISCORD_PUBLIC_KEY` to verify requests
❌ **Don't test with browser** - Discord sends special headers that browsers don't

### Verification Checklist

- [ ] Using the correct Discord application (Core vs Spotify)
- [ ] Using the root URL without `/interactions` suffix
- [ ] `DISCORD_PUBLIC_KEY` secret is set in Cloudflare
- [ ] Public key matches the Discord application
- [ ] Worker is deployed and responding to GET requests
- [ ] No typos in the URL

### Still Not Working?

1. **Check Worker Logs**
   ```bash
   cd casie-core  # or casie-spotify
   npx wrangler tail
   ```
   Then try to save the endpoint URL in Discord and watch for errors

2. **Verify Public Key Format**
   - Should be a 64-character hexadecimal string
   - No spaces or line breaks
   - Example format: `abc123def456...` (64 chars)

3. **Redeploy Worker**
   ```bash
   cd casie-core  # or casie-spotify
   npm run deploy
   ```

### Success!

If validation succeeds, Discord will show a green checkmark ✅ next to the URL, and you can start using slash commands!

---

**Need Help?** Check the worker logs with `npx wrangler tail` to see what Discord is sending.
