/**
 * Discord Command Registration Script for Unified CASIE Bot
 *
 * Run this script to register ALL slash commands with Discord.
 * Make sure to set DISCORD_BOT_TOKEN and APPLICATION_ID before running.
 *
 * Usage:
 *   node register-commands.js
 *
 * Or with environment variables:
 *   DISCORD_BOT_TOKEN=xxx APPLICATION_ID=yyy node register-commands.js
 */

// Load .env file
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
}

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const APPLICATION_ID = process.env.APPLICATION_ID || 'YOUR_APPLICATION_ID_HERE';

const commands = [
  // ========== CORE COMMANDS ==========
  {
    name: 'chat',
    description: 'Chat with AI assistant',
    dm_permission: false,
    options: [
      {
        name: 'query',
        description: 'What do you want to ask?',
        type: 3, // STRING type
        required: true,
      },
    ],
  },
  {
    name: 'web-search',
    description: 'Search the web with AI summarization (powered by Brave + LLM)',
    dm_permission: false,
    options: [
      {
        name: 'query',
        description: 'What do you want to search for?',
        type: 3, // STRING type
        required: true,
      },
    ],
  },
  {
    name: 'clear',
    description: 'Clear all messages in the channel',
    dm_permission: false,
  },
  {
    name: 'pdf',
    description: '📄 Analyze a PDF document with AI (Llama 4 Scout)',
    dm_permission: false,
    options: [
      {
        name: 'file',
        description: 'PDF file to analyze',
        type: 11, // ATTACHMENT type
        required: true,
      },
      {
        name: 'question',
        description: 'Optional: Ask a specific question about the document',
        type: 3, // STRING type
        required: false,
      },
    ],
  },
  {
    name: 'videos',
    description: '🎬 Browse your TV library or open episodes with natural language',
    dm_permission: false,
    options: [
      {
        name: 'query',
        description: 'Browse: "what shows?" | Open: "play friends s01e01" | Search: "search friends"',
        type: 3, // STRING type
        required: true,
      },
    ],
  },
  {
    name: 'pc-lock',
    description: 'Lock your Windows PC with confirmation (requires CASIE Bridge)',
    dm_permission: false,
  },
  {
    name: 'pc-restart',
    description: 'Restart your Windows PC with confirmation (requires CASIE Bridge)',
    dm_permission: false,
  },
  {
    name: 'pc-shutdown',
    description: 'Shutdown your Windows PC with confirmation (requires CASIE Bridge)',
    dm_permission: false,
  },
  {
    name: 'pc-sleep',
    description: 'Put your Windows PC to sleep with confirmation (requires CASIE Bridge)',
    dm_permission: false,
  },

  // ========== SPOTIFY COMMANDS ==========
  {
    name: 'linkspotify',
    description: 'Link your Spotify account to CASIE',
    dm_permission: false,
  },
  {
    name: 'play',
    description: 'Search Spotify for tracks and play them',
    dm_permission: false,
    options: [
      {
        name: 'query',
        description: 'Track name, artist, or search query',
        type: 3, // STRING type
        required: true,
      },
    ],
  },
  {
    name: 'resume',
    description: 'Resume or start playback on your Spotify',
    dm_permission: false,
  },
  {
    name: 'pause',
    description: 'Pause your current Spotify playback',
    dm_permission: false,
  },
  {
    name: 'next',
    description: 'Skip to the next track in your Spotify queue',
    dm_permission: false,
  },
  {
    name: 'previous',
    description: 'Go back to the previous track on Spotify',
    dm_permission: false,
  },
  {
    name: 'nowplaying',
    description: 'Show what you\'re currently listening to on Spotify',
    dm_permission: false,
  },
  {
    name: 'playlists',
    description: 'View your Spotify playlists',
    dm_permission: false,
  },
];

async function registerCommands() {
  console.log('🤖 Registering CASIE (Unified Bot) commands with Discord...\n');

  // Validate configuration
  if (DISCORD_BOT_TOKEN.includes('YOUR_') || APPLICATION_ID.includes('YOUR_')) {
    console.error('❌ Error: Please set DISCORD_BOT_TOKEN and APPLICATION_ID');
    console.error('\nYou can either:');
    console.error('  1. Edit this file and replace the placeholder values');
    console.error('  2. Set environment variables:\n');
    console.error('     DISCORD_BOT_TOKEN=xxx APPLICATION_ID=yyy node register-commands.js\n');
    process.exit(1);
  }

  const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
      body: JSON.stringify(commands),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Successfully registered all commands!\n');
      console.log(`Registered ${data.length} command(s):\n`);

      // Group and display commands
      const coreCommands = data.filter(cmd =>
        ['chat', 'web-search', 'clear', 'pdf', 'videos', 'pc-lock', 'pc-restart', 'pc-shutdown', 'pc-sleep'].includes(cmd.name)
      );
      const spotifyCommands = data.filter(cmd =>
        ['linkspotify', 'play', 'resume', 'pause', 'next', 'previous', 'nowplaying', 'playlists'].includes(cmd.name)
      );

      console.log('📌 Core Commands:');
      coreCommands.forEach((cmd) => {
        console.log(`  /${cmd.name} - ${cmd.description}`);
      });

      console.log('\n🎵 Spotify Commands:');
      spotifyCommands.forEach((cmd) => {
        console.log(`  /${cmd.name} - ${cmd.description}`);
      });

      console.log('\n🎉 All commands registered successfully!');
      console.log('   (It may take a few minutes to propagate in Discord)\n');
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to register commands\n');
      console.error(`Status: ${response.status} ${response.statusText}`);
      console.error(`Error: ${errorText}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Network error while registering commands:\n');
    console.error(error);
    process.exit(1);
  }
}

// Run the registration
registerCommands();
