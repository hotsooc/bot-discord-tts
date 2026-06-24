const { SlashCommandBuilder } = require('discord.js');
const { queueTTS, VOICE_CHOICES } = require('../../utils/audio');
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
    )
    .addStringOption(option =>
      option.setName('voice')
        .setDescription('Kiểu giọng đọc (mặc định: Mặc định)')
        .setRequired(false)
        .addChoices(...VOICE_CHOICES)
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

    const botMember = interaction.guild.members.me;
    if (botMember.voice.channel && botMember.voice.channel.id !== voiceChannel.id) {
      await interaction.reply({
        content: '🤖 Bạn phải ở cùng kênh voice với bot.',
        ephemeral: true,
      });
      return;
    }

    const connection = getVoiceConnection(interaction.guild.id);
    if (!connection && !botMember.voice.channel) {
      // cho phép /say tự join nếu bot chưa ở voice
    }

    const text = interaction.options.getString('text');
    const voice = interaction.options.getString('voice') || 'macdinh';

    try {
      await queueTTS(interaction, text, voiceChannel, voice);
      await interaction.reply({
        content: `**${interaction.member.displayName}** nói: **${text}**`,
      });
      logger.info(`Lệnh /say được gọi bởi ${interaction.user.tag}: "${text}" (voice: ${voice})`);
    } catch (error) {
      logger.error(`Lỗi khi xử lý lệnh /say bởi ${interaction.user.tag}:`, error);
      await interaction.reply({
        content: '❌ Lỗi khi xử lý văn bản TTS.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
