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
    name: 'weather',
    description: 'Get current weather information',
    dm_permission: false,
    options: [
      {
        name: 'location',
        description: 'City name (e.g., Buffalo, New York, Tokyo)',
        type: 3, // STRING type
        required: false,
      },
    ],
  },
  {
    name: 'clear',
    description: 'Clear all messages in the channel',
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
