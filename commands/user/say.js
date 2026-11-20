const { SlashCommandBuilder } = require('discord.js');
const { queueTTS, VOICE_CHOICES } = require('../../utils/audio');
const { getVoiceConnection } = require('@discordjs/voice');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Phát văn bản thành giọng nói trong kênh voice.')
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Văn bản cần phát')
        .setRequired(true)
        .setMaxLength(500)
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
        content: '🔊 Bạn phải vào một kênh voice trước.',
        ephemeral: true,
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

    const text = interaction.options.getString('text');
    const voice = interaction.options.getString('voice') || 'macdinh';

    try {
      const queued = await queueTTS(interaction, text, voiceChannel, voice);
      if (queued) {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: `🗣️ **${interaction.member.displayName}**: ${text}`,
          });
        }
        logger.info(`Lệnh /say được gọi bởi ${interaction.user.tag}: "${text}" (voice: ${voice})`);
      }
    } catch (error) {
      logger.error(`Lỗi khi xử lý lệnh /say bởi ${interaction.user.tag}:`, error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Lỗi khi xử lý văn bản TTS.',
          ephemeral: true,
        });
      }
    }
  },
};
