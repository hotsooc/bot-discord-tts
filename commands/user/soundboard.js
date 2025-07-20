const { SlashCommandBuilder } = require('discord.js');
const { playSound } = require('../../utils/audio');
const { hasPermission } = require('../../utils/permissions');
const logger = require('../../utils/logger');
const fs = require('fs');
const path = require('path');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('soundboard')
    .setDescription('Phát một âm thanh từ soundboard trong kênh voice.')
    .addStringOption(option =>
      option.setName('sound')
        .setDescription('Tên âm thanh cần phát')
        .setRequired(true)
        .addChoices(
          ...fs.readdirSync(path.join(__dirname, '../../assets/soundboards'))
            .filter(file => file.endsWith('.mp3'))
            .map(file => ({ name: file.split('.')[0], value: file }))
        )),
  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply({ content: '🔊 Bạn phải vào kênh voice trước.', ephemeral: true });
      return;
    }

    const soundFile = interaction.options.getString('sound');
    try {
      await playSound(interaction, soundFile, voiceChannel, 'soundboards');
      await interaction.reply({ content: `Tính năng đang phát triển ^^ `, ephemeral: true });
      logger.info(`Lệnh /soundboard được gọi bởi ${interaction.user.tag}: "${soundFile}"`);
    } catch (error) {
      logger.error(`Lỗi khi xử lý lệnh /soundboard bởi ${interaction.user.tag}:`, error);
      await interaction.reply({ content: `❌ Lỗi khi phát âm thanh ${soundFile}.`, ephemeral: true });
    }
  },
};