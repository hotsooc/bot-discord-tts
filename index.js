
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { loadEvents } = require('./utils/eventLoader');
const { loadCommands } = require('./utils/commandLoader');
const { startIdleMonitor } = require('./utils/voiceManager');
const logger = require('./utils/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

(async () => {
  await loadCommands();

  loadEvents(client);
  startIdleMonitor(client);

  client.login(process.env.DISCORD_TOKEN).catch(error => {
    logger.error('Error logging in bot:', error);
    process.exit(1);
  });
})();