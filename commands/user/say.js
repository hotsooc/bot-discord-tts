const { SlashCommandBuilder } = require('discord.js');
const { queueTTS } = require('../../utils/audio');
const { getVoiceConnection } = require('@discordjs/voice');
const { MessageFlags } = require('discord-api-types/v10');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Phát văn bản thành giọng nói trong kênh voice.')
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Văn bản cần phát')
        .setRequired(true)
    ),
  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply({
        content: '🔊 Bạn phải vào kênh voice trước.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const connection = getVoiceConnection(interaction.guild.id);
    if (!connection) {
      await interaction.reply({
        content: '❗ Bot chưa ở trong voice. Hãy dùng lệnh `/join` trước.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }


    const text = interaction.options.getString('text');
    try {
      await queueTTS(interaction, text, voiceChannel);
      await interaction.reply({
        content: `**${interaction.member.displayName}** nói: **${text}**`,
      });
      logger.info(`Lệnh /say được gọi bởi ${interaction.user.tag}: "${text}"`);
    } catch (error) {
      logger.error(`Lỗi khi xử lý lệnh /say bởi ${interaction.user.tag}:`, error);
      await interaction.reply({
        content: '❌ Lỗi khi xử lý văn bản TTS.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
