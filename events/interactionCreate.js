const { Events } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { playSound } = require('../utils/audio');
const { getCommand } = require('../utils/commandLoader');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'soundboard_select') {
      await handleSoundboard(interaction);
    }
  },
};

async function handleCommand(interaction) {
  const { banned } = await loadBannedUsers();
  if (banned.has(interaction.user.id)) {
    await interaction.reply({
      content: 'Bạn đã bị cấm sử dụng bot này.',
      ephemeral: true,
    });
    return;
  }

  const command = getCommand(interaction.commandName);
  if (!command) {
    await interaction.reply({
      content: `Lệnh ${interaction.commandName} không tồn tại!`,
      ephemeral: true,
    });
    logger.warn(`Lệnh ${interaction.commandName} không được tìm thấy`);
    return;
  }

  try {
    await command.execute(interaction);
    logger.info(`Đã thực hiện lệnh ${interaction.commandName} bởi ${interaction.user.tag}`);
  } catch (error) {
    logger.error(`Lỗi khi thực hiện lệnh ${interaction.commandName}:`, error);
    await interaction.reply({
      content: 'Có lỗi xảy ra khi thực hiện lệnh!',
      ephemeral: true,
    }).catch(() => {});
  }
}

async function handleSoundboard(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    await interaction.reply({ content: '🔊 Bạn phải vào kênh voice trước.', ephemeral: true });
    return;
  }

  const botMember = interaction.guild.members.me;
  if (!botMember.voice.channel) {
    await interaction.reply({ content: '🤖 Bot phải vào kênh voice trước. Sử dụng lệnh /join.', ephemeral: true });
    return;
  }

  if (botMember.voice.channel.id !== voiceChannel.id) {
    await interaction.reply({ content: '🤖 Bạn phải ở cùng kênh voice với bot.', ephemeral: true });
    return;
  }

  const soundFile = interaction.values[0];
  if (!soundFile) {
    await interaction.reply({ content: '❌ Không tìm thấy tệp âm thanh được chọn.', ephemeral: true });
    return;
  }

  await interaction.reply({
    content: `🎵 Đang phát âm thanh: **${soundFile.split('.')[0]}**`,
    ephemeral: true,
  });

  try {
    await playSound(interaction, soundFile, voiceChannel, 'soundboard');
    logger.info(`Soundboard "${soundFile}" được gọi bởi ${interaction.user.tag}`);
  } catch (error) {
    logger.error(`Lỗi xử lý soundboard bởi ${interaction.user.tag}: ${error.message}`);
    await interaction.followUp({
      content: `❌ Lỗi khi phát âm thanh **${soundFile}**.`,
      ephemeral: true,
    });
  }
}

async function loadBannedUsers() {
  let banned = new Set();
  try {
    const data = await fs.readFile(path.join(__dirname, '../data/blacklist.json'), 'utf-8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed.banned)) {
      banned = new Set(parsed.banned);
    }
  } catch (error) {
    logger.error('Lỗi khi đọc blacklist.json:', error);
  }
  return { banned };
}
