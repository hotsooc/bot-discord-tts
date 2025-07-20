const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { playSound, getLeaveFilePath } = require('../../utils/audio');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Bot rời khỏi kênh voice.'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const connection = getVoiceConnection(interaction.guild.id);
    if (!connection) {
      await interaction.editReply({ content: '❌ Bot không ở trong kênh voice.' });
      return;
    }

    const voiceChannel = interaction.member.voice.channel || interaction.guild.channels.cache.get(connection.joinConfig.channelId);

    try {
      const leaveFile = getLeaveFilePath();
      const leaveFileName = leaveFile.split('/').pop();

      await playSound(interaction, leaveFileName, voiceChannel, 'leave');

      connection.destroy();

      await interaction.editReply({ content: '👋 Bot đã rời khỏi kênh voice.' });
      logger.info(`Bot đã phát ${leaveFileName} và rời kênh voice bởi ${interaction.user.tag}`);
    } catch (error) {
      logger.error('Lỗi khi phát leave.mp3 hoặc rời kênh voice:', error);
      connection.destroy(); // Dù lỗi vẫn cố rời kênh
      await interaction.editReply({ content: '❌ Lỗi khi rời kênh voice.' });
    }
  },
};
