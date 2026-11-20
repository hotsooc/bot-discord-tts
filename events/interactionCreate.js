const { Events } = require('discord.js');
const logger = require('../utils/logger');
const { playSound } = require('../utils/audio');
const { getCommand } = require('../utils/commandLoader');
const blacklist = require('../utils/blacklist');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // 1. Xử lý Autocomplete
    if (interaction.isAutocomplete()) {
      const command = getCommand(interaction.commandName);
      if (command && command.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          logger.error(`Lỗi autocomplete cho lệnh ${interaction.commandName}:`, error);
        }
      }
      return;
    }

    // 2. Xử lý Slash Command
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
      return;
    }

    // 3. Xử lý Select Menu Soundboard
    if (interaction.isStringSelectMenu() && interaction.customId === 'soundboard_select') {
      await handleSoundboard(interaction);
      return;
    }
  },
};

async function handleCommand(interaction) {
  // Kiểm tra blacklist tức thời từ bộ nhớ cache
  if (blacklist.isBanned(interaction.user.id)) {
    await interaction.reply({
      content: '❌ Bạn đã bị cấm sử dụng bot này.',
      ephemeral: true,
    });
    return;
  }

  const command = getCommand(interaction.commandName);
  if (!command) {
    await interaction.reply({
      content: `❌ Lệnh **/${interaction.commandName}** không tồn tại!`,
      ephemeral: true,
    });
    logger.warn(`Lệnh /${interaction.commandName} không được tìm thấy`);
    return;
  }

  try {
    await command.execute(interaction);
    logger.info(`Đã thực hiện lệnh /${interaction.commandName} bởi ${interaction.user.tag}`);
  } catch (error) {
    logger.error(`Lỗi khi thực hiện lệnh /${interaction.commandName}:`, error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '⚠️ Có lỗi xảy ra khi thực hiện lệnh!',
        ephemeral: true,
      }).catch(() => {});
    } else {
      await interaction.followUp({
        content: '⚠️ Có lỗi xảy ra khi thực hiện lệnh!',
        ephemeral: true,
      }).catch(() => {});
    }
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

  const soundName = soundFile.replace(/\.mp3$/i, '');
  await interaction.reply({
    content: `🎵 Đang phát âm thanh: **${soundName}**`,
  });

  try {
    await playSound(interaction, soundFile, voiceChannel, 'soundboard');
    logger.info(`Soundboard "${soundFile}" được gọi bởi ${interaction.user.tag}`);
  } catch (error) {
    logger.error(`Lỗi xử lý soundboard bởi ${interaction.user.tag}: ${error.message}`);
  }
}
