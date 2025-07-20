const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(`✅ Bot đã đăng nhập với tên: ${client.user.tag}`);
  },
};