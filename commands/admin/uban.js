const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');
const { hasPermission } = require('../../utils/permissions');

const filePath = path.join(__dirname, '../../data/blacklist.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Bỏ cấm một người dùng sử dụng bot.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Người dùng cần bỏ cấm')
        .setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');

    const allowedRoles = ['Leader', 'Moderator'];
    if (!await hasPermission(interaction, null, allowedRoles)) {
      return;
    }

    let bannedUsers = { banned: [] };
    try {
      const data = await fs.readFile(filePath, 'utf8');
      bannedUsers = JSON.parse(data);
      if (!Array.isArray(bannedUsers.banned)) {
        bannedUsers.banned = [];
      }
    } catch (err) {
      logger.error('Lỗi khi đọc blacklist.json:', err);
    }

    if (!bannedUsers.banned.includes(targetUser.id)) {
      await interaction.followUp({
        content: `❌ ${targetUser.tag} không bị cấm.`,
        ephemeral: true,
      });
      return;
    }

    bannedUsers.banned = bannedUsers.banned.filter(id => id !== targetUser.id);

    try {
      await fs.writeFile(filePath, JSON.stringify(bannedUsers, null, 2));
      await interaction.followUp({
        content: `✅ ${targetUser.tag} đã được bỏ cấm.`,
        ephemeral: true,
      });
      logger.info(`Người dùng ${targetUser.tag} đã được bỏ cấm bởi ${interaction.user.tag}`);
    } catch (err) {
      logger.error('Lỗi khi ghi vào blacklist.json:', err);
      await interaction.followUp({
        content: '⚠️ Không thể cập nhật danh sách cấm. Vui lòng thử lại sau.',
        ephemeral: true,
      });
    }
  },
};