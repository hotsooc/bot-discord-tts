const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');
const { hasPermission } = require('../../utils/permissions');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Cấm một người dùng sử dụng bot.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Người dùng cần cấm')
        .setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');

    // check admin permission
    const allowedRoles = ['Leader', 'Moderator'];
    if (!await hasPermission(interaction, null, allowedRoles)) {
      return;
    }

    // Đảm bảo thư mục data tồn tại
    const dataDir = path.join(__dirname, '../../data');
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (err) {
      logger.error(`Lỗi khi tạo thư mục ${dataDir}:`, err);
      await interaction.followUp({
        content: '⚠️ Lỗi khi khởi tạo thư mục dữ liệu. Vui lòng thử lại sau.',
        ephemeral: true,
      });
      return;
    }

    const filePath = path.join(dataDir, 'blacklist.json');

    // Read blacklist file
    let bannedUsers = { banned: [] };
    try {
      const data = await fs.readFile(filePath, 'utf8');
      bannedUsers = JSON.parse(data);
      if (!Array.isArray(bannedUsers.banned)) {
        bannedUsers.banned = [];
        logger.warn(`blacklist.json không có mảng banned hợp lệ, khởi tạo lại: ${filePath}`);
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        logger.info(`Tệp ${filePath} không tồn tại, sẽ tạo mới`);
      } else {
        logger.error(`Lỗi khi đọc ${filePath}:`, err);
        await interaction.followUp({
          content: '⚠️ Lỗi khi đọc danh sách cấm. Vui lòng thử lại sau.',
          ephemeral: true,
        });
        return;
      }
    }

    // Check user banned
    if (bannedUsers.banned.includes(targetUser.id)) {
      await interaction.followUp({
        content: `❌ ${targetUser.tag} đã bị cấm sử dụng bot.`,
        ephemeral: true,
      });
      return;
    }

    // add user to blacklist
    bannedUsers.banned.push(targetUser.id);

    try {
      await fs.writeFile(filePath, JSON.stringify(bannedUsers, null, 2));
      await interaction.followUp({
        content: `✅ ${targetUser.tag} đã bị cấm sử dụng bot.`,
        ephemeral: true,
      });
      logger.info(`Người dùng ${targetUser.tag} (ID: ${targetUser.id}) đã được thêm vào ${filePath} bởi ${interaction.user.tag}`);
    } catch (err) {
      logger.error(`Lỗi khi ghi vào ${filePath}:`, err);
      await interaction.followUp({
        content: '⚠️ Không thể cập nhật danh sách cấm. Vui lòng kiểm tra quyền truy cập tệp.',
        ephemeral: true,
      });
    }
  },
};