
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { loadEvents } = require('./utils/eventLoader');
const logger = require('./utils/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

/**
 * Load events and login the bot.
 */
loadEvents(client);
client.login(process.env.DISCORD_TOKEN).catch(error => {
  logger.error('Error logging in bot:', error);
  process.exit(1);
});