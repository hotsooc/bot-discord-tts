const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Kiểm tra độ trễ của bot và Discord WebSocket.'),
  async execute(interaction) {
    const sent = await interaction.reply({ content: '🏓 Đang đo độ trễ...', fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = interaction.client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor('#2ed573')
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Độ trễ phản hồi (Roundtrip)', value: `\`${roundtrip}ms\``, inline: true },
        { name: 'WebSocket Heartbeat', value: `\`${wsPing}ms\``, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};
