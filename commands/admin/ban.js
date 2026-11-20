const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');
const { hasPermission } = require('../../utils/permissions');
const blacklist = require('../../utils/blacklist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Cấm một người dùng sử dụng bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Người dùng cần cấm')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');

    // Kiểm tra quyền (server owner, Administrator, hoặc role Leader / Moderator)
    const allowedRoles = ['Leader', 'Moderator'];
    if (!await hasPermission(interaction, null, allowedRoles)) {
      return;
    }

    if (targetUser.id === interaction.client.user.id) {
      await interaction.followUp({ content: '❌ Không thể cấm chính bot!', ephemeral: true });
      return;
    }

    if (blacklist.isBanned(targetUser.id)) {
      await interaction.followUp({
        content: `❌ ${targetUser.tag} đã ở trong danh sách cấm từ trước.`,
        ephemeral: true,
      });
      return;
    }

    try {
      await blacklist.ban(targetUser.id);
      await interaction.followUp({
        content: `✅ Đã cấm thành công người dùng **${targetUser.tag}** sử dụng bot.`,
        ephemeral: true,
      });
      logger.info(`Người dùng ${targetUser.tag} (${targetUser.id}) đã bị cấm bởi ${interaction.user.tag}`);
    } catch (err) {
      logger.error('Lỗi khi cấm người dùng:', err);
      await interaction.followUp({
        content: '⚠️ Không thể cập nhật danh sách cấm. Vui lòng kiểm tra lại.',
        ephemeral: true,
      });
    }
  },
};
