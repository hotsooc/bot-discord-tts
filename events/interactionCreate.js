const { Events } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { playSound } = require('../utils/audio');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Xử lí user bị ban
    if (interaction.isChatInputCommand()) {
      let bannedUsers = { banned: [] };
      try {
        const blacklistPath = path.join(__dirname, '../data/blacklist.json');
        const blacklistData = await fs.readFile(blacklistPath, 'utf-8');
        bannedUsers = JSON.parse(blacklistData);
      } catch (error) {
        logger.error('Lỗi khi đọc blacklist.json:', error);
      }

      const bannedSet = new Set(bannedUsers.banned || []);
      if (bannedSet.has(interaction.user.id)) {
        await interaction.reply({
          content: 'Bạn đã bị cấm sử dụng bot này.',
          ephemeral: true,
        });
        return;
      }

      const commandFolders = ['admin', 'user'];
      const commands = [];
      for (const folder of commandFolders) {
        try {
          const files = await fs.readdir(path.join(__dirname, '../commands', folder));
          for (const file of files.filter(f => f.endsWith('.js'))) {
            try {
              const command = require(path.join(__dirname, '../commands', folder, file));
              if (command && command.data && command.data.name && command.execute) {
                commands.push(command);
                logger.info(`Đã nạp lệnh ${command.data.name} từ ${folder}/${file}`);
              } else {
                logger.warn(`Tệp ${folder}/${file} không có thuộc tính data hoặc execute hợp lệ`);
              }
            } catch (error) {
              logger.error(`Lỗi khi nạp lệnh từ ${folder}/${file}:`, error);
            }
          }
        } catch (error) {
          logger.error(`Lỗi khi đọc thư mục commands/${folder}:`, error);
        }
      }

      const command = commands.find(cmd => cmd.data.name === interaction.commandName);
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

    // Xử lý tương tác menu
    if (interaction.isStringSelectMenu() && interaction.customId === 'soundboard_select') {
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) {
        await interaction.reply({
          content: '🔊 Bạn phải vào kênh voice trước.',
          ephemeral: true,
        });
        return;
      }

      const botMember = interaction.guild.members.me;
      if (!botMember.voice.channel) {
        await interaction.reply({
          content: '🤖 Bot phải vào kênh voice trước. Sử dụng lệnh /join.',
          ephemeral: true,
        });
        return;
      }

      if (botMember.voice.channel.id !== voiceChannel.id) {
        await interaction.reply({
          content: '🤖 Bạn phải ở cùng kênh voice với bot.',
          ephemeral: true,
        });
        return;
      }

      const soundFile = interaction.values[0]; // get lựa chọn
      if (!soundFile) {
        await interaction.reply({
          content: '❌ Không tìm thấy tệp âm thanh được chọn.',
          ephemeral: true,
        });
        return;
      }
      // reply lại sau khi chọn phát âm thanh
      await interaction.reply({
        content: `🎵 Đang phát âm thanh: **${soundFile.split('.')[0]}**`,
        ephemeral: true,
      });

      try {
        await playSound(interaction, soundFile, voiceChannel, 'soundboard');
        logger.info(`Lệnh /soundboard (select menu) được gọi bởi ${interaction.user.tag}: "${soundFile}"`);
      } catch (error) {
        logger.error(`Lỗi khi xử lý soundboard select bởi ${interaction.user.tag}: ${error.message}`);
        await interaction.followUp({
          content: `❌ Lỗi khi phát âm thanh **${soundFile}**.`,
          ephemeral: true,
        });
      }
    }
  },
};