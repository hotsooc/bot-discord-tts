const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

const commands = new Map();

async function loadCommands() {
  commands.clear();
  const commandFolders = ['admin', 'user'];
  const commandsDir = path.join(__dirname, '..', 'commands');

  for (const folder of commandFolders) {
    try {
      const files = await fs.readdir(path.join(commandsDir, folder));
      for (const file of files.filter(f => f.endsWith('.js'))) {
        const command = require(path.join(commandsDir, folder, file));
        if (command && command.data && command.data.name && command.execute) {
          commands.set(command.data.name, command);
          logger.info(`Đã nạp lệnh: ${command.data.name}`);
        } else {
          logger.warn(`Tệp ${folder}/${file} thiếu data hoặc execute`);
        }
      }
    } catch (error) {
      logger.error(`Lỗi khi đọc thư mục commands/${folder}:`, error);
    }
  }

  logger.info(`Đã nạp ${commands.size} lệnh`);
  return commands;
}

function getCommand(name) {
  return commands.get(name);
}

function getAllCommands() {
  return commands;
}

function getCommandDataArray() {
  return [...commands.values()].map(cmd => cmd.data.toJSON());
}

module.exports = { loadCommands, getCommand, getAllCommands, getCommandDataArray };
