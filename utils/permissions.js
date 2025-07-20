const { PermissionsBitField } = require('discord.js');
const logger = require('./logger');
const { safeReply } = require('./replyUtils');


async function hasPermission(interaction, permission = null, allowedRoles = []) {
  const member = interaction.member;
  const guild = interaction.guild;

  if (interaction.user.id === guild.ownerId) {
    logger.info(`User ${interaction.user.tag} is server owner, bypassing permission check for ${interaction.commandName}`);
    return true;
  }
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    logger.info(`User ${interaction.user.tag} has Administrator permission, bypassing role check for ${interaction.commandName}`);
    return true;
  }

  if (permission && !member.permissions.has(permission)) {
    const permissionName = Object.keys(PermissionsBitField.Flags).find(
      key => PermissionsBitField.Flags[key] === permission
    ) || permission;
    await safeReply(interaction, `❌ Bạn cần quyền **${permissionName}** để sử dụng lệnh này.`);
    logger.warn(`User ${interaction.user.tag} lacks permission ${permissionName} for command ${interaction.commandName}`);
    return false;
  }

  if (allowedRoles.length > 0) {
    const hasRole = member.roles.cache.some(role =>
      allowedRoles.includes(role.name)
    );

    if (!hasRole) {
      await safeReply(interaction, `❌ Bạn cần một trong các vai trò sau để sử dụng lệnh này: **${allowedRoles.join(', ')}**.`);
      logger.warn(`User ${interaction.user.tag} lacks required roles (${allowedRoles.join(', ')}) for command ${interaction.commandName}`);
      return false;
    }
  }

  logger.info(`User ${interaction.user.tag} passed permission check for ${interaction.commandName}`);
  return true;
}

module.exports = { hasPermission };