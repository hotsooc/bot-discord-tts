const { getVoiceConnection } = require('@discordjs/voice');
const logger = require('./logger');

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 phút
const CHECK_INTERVAL = 60 * 1000;   // kiểm tra mỗi 1 phút

const guildActivity = new Map();

function touchActivity(guildId) {
  guildActivity.set(guildId, Date.now());
}

function startIdleMonitor(client) {
  setInterval(() => {
    const now = Date.now();
    for (const [guildId, lastActive] of guildActivity.entries()) {
      if (now - lastActive > IDLE_TIMEOUT) {
        const connection = getVoiceConnection(guildId);
        if (connection) {
          const guild = client.guilds.cache.get(guildId);
          const channelName = guild?.channels.cache.get(connection.joinConfig.channelId)?.name || 'unknown';
          connection.destroy();
          guildActivity.delete(guildId);
          logger.info(`Tự động rời voice channel "${channelName}" ở guild ${guildId} sau ${IDLE_TIMEOUT / 60000} phút không hoạt động`);
        } else {
          guildActivity.delete(guildId);
        }
      }
    }
  }, CHECK_INTERVAL);

  logger.info(`Giám sát idle voice: tự động rời sau ${IDLE_TIMEOUT / 60000} phút`);
}

module.exports = { startIdleMonitor, touchActivity };
