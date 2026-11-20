const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Xem danh sách tất cả các lệnh của bot.'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor('#70a1ff')
      .setTitle('📖 Hướng Dẫn Sử Dụng Bot TTS')
      .setDescription('Bot chuyển văn bản thành giọng nói tiếng Việt và phát âm thanh soundboard trong kênh voice.')
      .addFields(
        {
          name: '🗣️ Lệnh Người Dùng (Voice & TTS)',
          value:
            '• `/say <text> [voice]`: Đọc văn bản trong kênh voice (hỗ trợ nhiều kiểu giọng).\n' +
            '• `/join`: Gọi bot tham gia kênh voice của bạn.\n' +
            '• `/leave`: Cho bot rời khỏi kênh voice.\n' +
            '• `/skip`: Bỏ qua câu đang đọc hoặc âm thanh hiện tại.\n' +
            '• `/stop`: Dừng phát và xóa sạch hàng đợi.\n' +
            '• `/soundboard [sound]`: Phát âm thanh từ soundboard (chọn nhanh hoặc qua menu).\n' +
            '• `/ping`: Kiểm tra độ trễ mạng của bot.',
        },
        {
          name: '🛡️ Lệnh Quản Trị (Admin)',
          value:
            '• `/ban <user>`: Cấm người dùng sử dụng bot.\n' +
            '• `/unban <user>`: Bỏ cấm người dùng.\n' +
            '• `/listban`: Xem danh sách những người đang bị cấm.',
        },
        {
          name: '⚡ Tính Năng Tự Động',
          value:
            '• Tự động ngắt kết nối sau 30 phút không hoạt động.\n' +
            '• Tự động rời phòng sau 60 giây nếu tất cả thành viên rời khỏi phòng voice.\n' +
            '• Tự động lọc link dài, tag user và emoji rác.',
        }
      )
      .setFooter({ text: 'Umaru-chan TTS Bot' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
