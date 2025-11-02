/**
 * Discord Command Registration Script for Core Bot
 *
 * Run this script to register slash commands with Discord.
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
  {
    name: 'ask',
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
    name: 'files',
    description: 'Query your local TV show library',
    dm_permission: false,
    options: [
      {
        name: 'query',
        description: 'What would you like to know?',
        type: 3, // STRING type
        required: true,
      },
    ],
  },
  {
    name: 'open',
    description: 'Search and open a TV show episode using natural language',
    dm_permission: false,
    options: [
      {
        name: 'query',
        description: 'Search for an episode (e.g., "Brooklyn Nine Nine season 1 episode 1")',
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
];

async function registerCommands() {
  console.log('🤖 Registering Core Bot commands with Discord...\n');

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
      console.log('✅ Successfully registered commands!\n');
      console.log(`Registered ${data.length} command(s):`);
      data.forEach((cmd) => {
        console.log(`  /${cmd.name} - ${cmd.description}`);
      });
      console.log('\n🎉 Commands should now be available in Discord!');
      console.log('   (It may take a few minutes to propagate)\n');
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
