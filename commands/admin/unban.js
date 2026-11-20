const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');
const { hasPermission } = require('../../utils/permissions');
const blacklist = require('../../utils/blacklist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Bỏ cấm một người dùng sử dụng bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Người dùng cần bỏ cấm')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');

    const allowedRoles = ['Leader', 'Moderator'];
    if (!await hasPermission(interaction, null, allowedRoles)) {
      return;
    }

    if (!blacklist.isBanned(targetUser.id)) {
      await interaction.followUp({
        content: `❌ ${targetUser.tag} không có trong danh sách cấm.`,
        ephemeral: true,
      });
      return;
    }

    try {
      await blacklist.unban(targetUser.id);
      await interaction.followUp({
        content: `✅ Đã bỏ cấm thành công cho người dùng **${targetUser.tag}**.`,
        ephemeral: true,
      });
      logger.info(`Người dùng ${targetUser.tag} (${targetUser.id}) đã được bỏ cấm bởi ${interaction.user.tag}`);
    } catch (err) {
      logger.error('Lỗi khi bỏ cấm người dùng:', err);
      await interaction.followUp({
        content: '⚠️ Không thể cập nhật danh sách cấm. Vui lòng thử lại sau.',
        ephemeral: true,
      });
    }
  },
};
