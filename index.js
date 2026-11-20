require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { loadEvents } = require('./utils/eventLoader');
const { loadCommands } = require('./utils/commandLoader');
const { startIdleMonitor } = require('./utils/voiceManager');
const logger = require('./utils/logger');

// Xử lý bắt lỗi toàn cục tránh crash tiến trình
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

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
