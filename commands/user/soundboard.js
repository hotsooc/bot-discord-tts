const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { playSound } = require('../../utils/audio');
const logger = require('../../utils/logger');
const fs = require('fs');
const path = require('path');

function getSoundList() {
  const soundboardPath = path.join(__dirname, '../../assets/soundboard');
  if (!fs.existsSync(soundboardPath)) return [];
  return fs
    .readdirSync(soundboardPath)
    .filter(file => file.endsWith('.mp3'))
    .map(file => ({
      name: file.replace(/\.mp3$/i, ''),
      value: file,
    }));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('soundboard')
    .setDescription('Phát một âm thanh từ soundboard trong kênh voice.')
    .addStringOption(option =>
      option.setName('sound')
        .setDescription('Tên âm thanh muốn phát (gõ để tìm kiếm)')
        .setRequired(false)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const sounds = getSoundList();
    const filtered = sounds
      .filter(s => s.name.toLowerCase().includes(focusedValue))
      .slice(0, 25);

    await interaction.respond(
      filtered.map(s => ({ name: s.name, value: s.value }))
    );
  },

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
        content: '🤖 Bot phải vào kênh voice trước. Sử dụng lệnh /join hoặc gọi /say.',
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

    const soundOption = interaction.options.getString('sound');

    // Nếu người dùng đã chọn cụ thể qua autocomplete
    if (soundOption) {
      const soundName = soundOption.replace(/\.mp3$/i, '');
      await interaction.reply({
        content: `🎵 Đang phát âm thanh: **${soundName}**`,
      });

      try {
        await playSound(interaction, soundOption, voiceChannel, 'soundboard');
        logger.info(`Soundboard "${soundOption}" được phát bởi ${interaction.user.tag}`);
      } catch (error) {
        logger.error(`Lỗi khi phát soundboard: ${error.message}`);
      }
      return;
    }

    // Nếu không chọn âm thanh, hiển thị Select Menu
    const sounds = getSoundList();
    if (sounds.length === 0) {
      await interaction.reply({
        content: '❌ Không tìm thấy âm thanh nào trong thư mục soundboard.',
        ephemeral: true,
      });
      return;
    }

    const options = sounds.slice(0, 25).map(s => ({
      label: s.name,
      value: s.value,
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('soundboard_select')
      .setPlaceholder('Chọn một âm thanh để phát...')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: '🎶 Vui lòng chọn một âm thanh từ danh sách dưới đây:',
      components: [row],
      ephemeral: true,
    });
  },
};
