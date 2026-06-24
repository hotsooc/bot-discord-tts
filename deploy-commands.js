const { REST, Routes } = require('discord.js');
const { loadCommands, getCommandDataArray } = require('./utils/commandLoader');
const logger = require('./utils/logger');
require('dotenv').config();

async function deployCommands() {
  try {
    await loadCommands();
    const commands = getCommandDataArray();
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    logger.info('Bắt đầu làm mới các lệnh slash (/)...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    logger.info(`Đã đăng ký thành công ${commands.length} lệnh.`);
  } catch (error) {
    logger.error('Lỗi khi đăng ký lệnh:', error);
  }
}

deployCommands();
