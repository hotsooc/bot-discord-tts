const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');
const { hasPermission } = require('../../utils/permissions');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('listban')
    .setDescription('Hiển thị danh sách người dùng bị cấm sử dụng bot.'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const allowedRoles = ['Leader', 'Moderator'];
    if (!await hasPermission(interaction, null, allowedRoles)) {
      return;
    }

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
        logger.info(`Tệp ${filePath} không tồn tại, trả về danh sách rỗng`);
      } else {
        logger.error(`Lỗi khi đọc ${filePath}:`, err);
        await interaction.followUp({
          content: '⚠️ Lỗi khi đọc danh sách cấm. Vui lòng thử lại sau.',
          ephemeral: true,
        });
        return;
      }
    }

    if (bannedUsers.banned.length === 0) {
      await interaction.followUp({
        content: '✅ Không có người dùng nào trong danh sách cấm.',
        ephemeral: true,
      });
      logger.info(`Lệnh /listban được gọi bởi ${interaction.user.tag}: Danh sách cấm rỗng`);
      return;
    }

    const bannedList = [];
    for (const userId of bannedUsers.banned) {
      try {
        const user = await interaction.client.users.fetch(userId);
        let displayName = 'Không xác định';
        try {
          const member = await interaction.guild.members.fetch(userId);
          displayName = member.displayName || user.username;
        } catch (memberError) {
          logger.warn(`Không thể lấy GuildMember cho người dùng ${userId}:`, memberError);
        }
        bannedList.push(`- ${displayName} (username: ${user.username})`);
      } catch (error) {
        bannedList.push(`- Không xác định (username: Không xác định`);
        logger.warn(`Không thể lấy thông tin người dùng ${userId}:`, error);
      }
    }

    // Dislay
    const response = `📜 **Danh sách người dùng bị cấm**:\n${bannedList.join('\n')}`;
    try {
      await interaction.followUp({
        content: response,
        ephemeral: true,
      });
      logger.info(`Lệnh /listban được gọi bởi ${interaction.user.tag}: Hiển thị ${bannedUsers.banned.length} người dùng bị cấm`);
    } catch (error) {
      logger.error(`Lỗi khi trả lời lệnh /listban bởi ${interaction.user.tag}:`, error);
      await interaction.followUp({
        content: '⚠️ Lỗi khi hiển thị danh sách cấm. Vui lòng thử lại sau.',
        ephemeral: true,
      });
    }
  },
};