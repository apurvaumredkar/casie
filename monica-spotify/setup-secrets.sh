#!/bin/bash

# SpotiBot Secrets Setup Script
# This script helps you set all required secrets for the monica-spotify worker

echo "🔐 SpotiBot Secrets Setup"
echo "========================"
echo ""
echo "This script will help you set up the required secrets for SpotiBot."
echo "You'll need to provide values for each secret."
echo ""

# Check if we're in the right directory
if [ ! -f "wrangler.toml" ]; then
    echo "❌ Error: wrangler.toml not found. Please run this script from the spotify-worker directory."
    exit 1
fi

echo "📋 Required secrets:"
echo "  1. DISCORD_PUBLIC_KEY - From Discord Developer Portal → Your App → General Information"
echo "  2. DISCORD_BOT_TOKEN - From Discord Developer Portal → Your App → Bot"
echo "  3. SPOTIFY_CLIENT_ID - From Spotify Developer Dashboard → Your App → Settings"
echo "  4. SPOTIFY_CLIENT_SECRET - From Spotify Developer Dashboard → Your App → Settings"
echo "  5. SPOTIFY_REDIRECT_URI - Your worker URL + /oauth/callback"
echo "  6. OPENROUTER_API_KEY - From OpenRouter (https://openrouter.ai/keys)"
echo ""

echo "💡 Tip: If you already have these set for the main Monica worker,"
echo "   you can use the same OPENROUTER_API_KEY for both workers."
echo ""

read -p "Do you want to proceed with setting secrets? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Setting secrets..."
echo ""

# Set each secret
echo "1/6: Setting DISCORD_PUBLIC_KEY..."
npx wrangler secret put DISCORD_PUBLIC_KEY

echo ""
echo "2/6: Setting DISCORD_BOT_TOKEN..."
npx wrangler secret put DISCORD_BOT_TOKEN

echo ""
echo "3/6: Setting SPOTIFY_CLIENT_ID..."
npx wrangler secret put SPOTIFY_CLIENT_ID

echo ""
echo "4/6: Setting SPOTIFY_CLIENT_SECRET..."
npx wrangler secret put SPOTIFY_CLIENT_SECRET

echo ""
echo "5/6: Setting SPOTIFY_REDIRECT_URI..."
echo "💡 For production, this should be: https://monica-spotify.YOUR_SUBDOMAIN.workers.dev/oauth/callback"
npx wrangler secret put SPOTIFY_REDIRECT_URI

echo ""
echo "6/6: Setting OPENROUTER_API_KEY..."
echo "💡 You can use the same key as your main Monica worker"
npx wrangler secret put OPENROUTER_API_KEY

echo ""
echo "✅ All secrets set!"
echo ""
echo "📊 Verifying secrets..."
npx wrangler secret list

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Register Discord commands: node register-commands.js"
echo "  2. Update Discord interactions endpoint"
echo "  3. Update Spotify redirect URI in Spotify Dashboard"
echo "  4. Test the bot in Discord!"
echo ""
