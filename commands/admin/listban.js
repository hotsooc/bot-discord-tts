const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const { hasPermission } = require('../../utils/permissions');
const blacklist = require('../../utils/blacklist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listban')
    .setDescription('Hiển thị danh sách người dùng bị cấm sử dụng bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const allowedRoles = ['Leader', 'Moderator'];
    if (!await hasPermission(interaction, null, allowedRoles)) {
      return;
    }

    const bannedIds = blacklist.getBannedList();

    if (bannedIds.length === 0) {
      await interaction.followUp({
        content: '✅ Hiện tại không có người dùng nào trong danh sách cấm.',
        ephemeral: true,
      });
      return;
    }

    const bannedList = [];
    for (const userId of bannedIds) {
      try {
        const user = await interaction.client.users.fetch(userId);
        bannedList.push(`• **${user.tag}** (\`${user.id}\`)`);
      } catch {
        bannedList.push(`• \`ID: ${userId}\` (Không rõ thông tin)`);
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#ff4757')
      .setTitle('📜 Danh Sách Người Dùng Bị Cấm')
      .setDescription(bannedList.join('\n'))
      .setFooter({ text: `Tổng cộng: ${bannedIds.length} người dùng` })
      .setTimestamp();

    await interaction.followUp({
      embeds: [embed],
      ephemeral: true,
    });
  },
};
