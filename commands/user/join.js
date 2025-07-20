const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { playSound, getGreetingFilePath } = require('../../utils/audio');
const { hasPermission } = require('../../utils/permissions');
const logger = require('../../utils/logger');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Bot tham gia kênh voice và phát âm thanh chào hỏi.'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      await interaction.followUp({ content: '🔊 Bạn phải vào kênh voice trước.', ephemeral: true });
      return;
    }

    try {
      const greetingFile = getGreetingFilePath();
      await playSound(interaction, greetingFile, voiceChannel, 'greeting');
      await interaction.followUp({ content: `✅ Đã tham gia kênh voice và phát âm thanh chào hỏi.`, ephemeral: true });
      logger.info(`Lệnh /join được gọi bởi ${interaction.user.tag} trong kênh ${voiceChannel.name}`);
    } catch (error) {
      logger.error(`Lỗi khi thực hiện lệnh /join bởi ${interaction.user.tag}:`, error);
      await interaction.followUp({ content: '❌ Lỗi khi tham gia kênh voice hoặc phát âm thanh.', ephemeral: true });
    }
  },
};