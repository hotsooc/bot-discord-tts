const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { playSound } = require('../../utils/audio');
const logger = require('../../utils/logger');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('soundboard')
    .setDescription('Phát một âm thanh từ soundboard trong kênh voice.'),
  async execute(interaction) {
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

    // Lấy danh sách âm thanh
    const soundboardPath = path.join(__dirname, '../../assets/soundboard');
    let soundFiles = [];
    try {
      if (fs.existsSync(soundboardPath)) {
        soundFiles = fs
          .readdirSync(soundboardPath)
          .filter(file => file.endsWith('.mp3'))
          .map(file => ({ label: file.split('.')[0], value: file }));
        if (soundFiles.length === 0) {
          await interaction.reply({
            content: '❌ Không tìm thấy âm thanh nào trong thư mục soundboard.',
            ephemeral: true,
          });
          return;
        }
      } else {
        logger.warn(`Thư mục soundboard không tồn tại tại: ${soundboardPath}`);
        await interaction.reply({
          content: '❌ Thư mục soundboard không tồn tại.',
          ephemeral: true,
        });
        return;
      }
    } catch (error) {
      logger.error(`Lỗi khi đọc thư mục soundboard: ${error.message}`);
      await interaction.reply({
        content: '❌ Lỗi khi tải danh sách âm thanh.',
        ephemeral: true,
      });
      return;
    }

    // Giới hạn tối đa 25 tùy chọn cho select menu
    const options = soundFiles.slice(0, 25); // giới hạn 25 tùy chọn
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('soundboard_select')
      .setPlaceholder('Chọn một âm thanh để phát')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: '🎶 Vui lòng chọn một âm thanh từ danh sách:',
      components: [row],
      ephemeral: true,
    });
  },
};