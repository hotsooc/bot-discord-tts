const { getVoiceConnection } = require('@discordjs/voice');
const logger = require('./logger');

const IDLE_TIMEOUT = 30 * 60 * 1000;   // 30 phút không có âm thanh
const CHECK_INTERVAL = 60 * 1000;     // kiểm tra mỗi 1 phút
const EMPTY_CHANNEL_TIMEOUT = 60 * 1000; // 1 phút khi không còn ai trong phòng

const guildActivity = new Map();
const emptyTimers = new Map();

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
          logger.info(`Tự động rời voice channel "${channelName}" ở guild ${guildId} sau ${IDLE_TIMEOUT / 60000} phút không có hoạt động phát âm`);
        } else {
          guildActivity.delete(guildId);
        }
      }
    }
  }, CHECK_INTERVAL);

  logger.info(`Giám sát idle voice: tự động rời sau ${IDLE_TIMEOUT / 60000} phút không dùng`);
}

async function handleVoiceStateUpdate(oldState, newState) {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;

  const connection = getVoiceConnection(guild.id);
  if (!connection) {
    if (emptyTimers.has(guild.id)) {
      clearTimeout(emptyTimers.get(guild.id));
      emptyTimers.delete(guild.id);
    }
    return;
  }

  const botChannelId = connection.joinConfig.channelId;
  const botChannel = guild.channels.cache.get(botChannelId);
  if (!botChannel) return;

  // Đếm số thành viên không phải là bot trong phòng
  const humanMembers = botChannel.members.filter(member => !member.user.bot);

  if (humanMembers.size === 0) {
    if (!emptyTimers.has(guild.id)) {
      logger.info(`Phòng voice "${botChannel.name}" ở guild ${guild.id} không còn người, hẹn giờ rời sau ${EMPTY_CHANNEL_TIMEOUT / 1000}s`);
      const timer = setTimeout(() => {
        emptyTimers.delete(guild.id);
        const currentConn = getVoiceConnection(guild.id);
        if (currentConn) {
          const currentChannel = guild.channels.cache.get(currentConn.joinConfig.channelId);
          const humansNow = currentChannel?.members.filter(m => !m.user.bot);
          if (!humansNow || humansNow.size === 0) {
            currentConn.destroy();
            guildActivity.delete(guild.id);
            logger.info(`Đã tự động rời voice channel "${botChannel.name}" do không còn ai trong phòng`);
          }
        }
      }, EMPTY_CHANNEL_TIMEOUT);

      emptyTimers.set(guild.id, timer);
    }
  } else {
    // Có người trong phòng, hủy timer nếu có
    if (emptyTimers.has(guild.id)) {
      clearTimeout(emptyTimers.get(guild.id));
      emptyTimers.delete(guild.id);
      logger.info(`Đã phát hiện có thành viên trong phòng "${botChannel.name}", hủy hẹn giờ rời`);
    }
  }
}

module.exports = {
  startIdleMonitor,
  touchActivity,
  handleVoiceStateUpdate,
};
