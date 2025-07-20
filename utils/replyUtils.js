const logger = require('./logger');


async function safeReply(interaction, content, options = { ephemeral: true }) {
  try {
    if (interaction.deferred) {
      await interaction.followUp({ content, ...options });
    } else if (!interaction.replied) {
      await interaction.reply({ content, ...options });
    } else {
      await interaction.followUp({ content, ...options });
    }
  } catch (error) {
    logger.error(`Lỗi khi gửi phản hồi cho interaction ${interaction.commandName || interaction.id}:`, error);
  }
}

module.exports = { safeReply };