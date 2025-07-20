const { REST, Routes } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./utils/logger');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');


async function loadCommands(directory) {
  const items = await fs.readdir(directory, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(directory, item.name);
    if (item.isDirectory()) {
      await loadCommands(fullPath);
    } else if (item.name.endsWith('.js')) {
      const command = require(fullPath);
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        logger.info(`Đã nạp lệnh: ${command.data.name}`);
      } else {
        logger.warn(`Tệp ${item.name} thiếu thuộc tính data hoặc execute`);
      }
    }
  }
}


async function deployCommands() {
  try {
    await loadCommands(commandsPath);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    logger.info('Bắt đầu làm mới các lệnh slash (/)...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    logger.info('Đã đăng ký thành công tất cả lệnh.');
  } catch (error) {
    logger.error('Lỗi khi đăng ký lệnh:', error);
  }
}

deployCommands();