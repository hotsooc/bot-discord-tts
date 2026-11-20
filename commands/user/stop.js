const { SlashCommandBuilder } = require('discord.js');
const { stopTTS } = require('../../utils/audio');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Dừng phát và xóa toàn bộ hàng đợi TTS của máy chủ.'),
  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply({ content: '🔊 Bạn phải vào kênh voice trước.', ephemeral: true });
      return;
    }

    stopTTS(interaction.guild.id);
    await interaction.reply({ content: '⏹️ Đã dừng phát và xóa toàn bộ hàng đợi âm thanh.' });
    logger.info(`Lệnh /stop được gọi bởi ${interaction.user.tag}`);
  },
};
