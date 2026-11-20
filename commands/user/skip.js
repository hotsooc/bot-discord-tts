const { SlashCommandBuilder } = require('discord.js');
const { skipTTS } = require('../../utils/audio');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Bỏ qua câu TTS hoặc âm thanh đang phát.'),
  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply({ content: '🔊 Bạn phải vào kênh voice trước.', ephemeral: true });
      return;
    }

    const skipped = skipTTS(interaction.guild.id);
    if (skipped) {
      await interaction.reply({ content: '⏭️ Đã bỏ qua âm thanh đang phát.' });
      logger.info(`Lệnh /skip được gọi bởi ${interaction.user.tag}`);
    } else {
      await interaction.reply({ content: 'ℹ️ Không có âm thanh nào đang được phát.', ephemeral: true });
    }
  },
};
