const { REST, Routes } = require('discord.js');
const { loadCommands, getCommandDataArray } = require('./utils/commandLoader');
const logger = require('./utils/logger');
require('dotenv').config();

async function deployCommands() {
  try {
    await loadCommands();
    const commands = getCommandDataArray();
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    // Tự động lấy Client ID nếu trong .env chưa cấu hình
    let clientId = process.env.CLIENT_ID;
    if (!clientId) {
      try {
        const currentUser = await rest.get(Routes.user('@me'));
        clientId = currentUser.id;
        logger.info(`Đã tự động nhận diện Client ID từ token: ${clientId} (${currentUser.username})`);
      } catch (err) {
        throw new Error(`Không thể lấy Client ID từ Discord Token: ${err.message}`);
      }
    }

    logger.info('Bắt đầu làm mới các lệnh slash (/)...');

    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(clientId, process.env.GUILD_ID),
        { body: commands }
      );
      logger.info(`Đã đăng ký thành công ${commands.length} lệnh cho Guild ID: ${process.env.GUILD_ID}`);
    } else {
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      logger.info(`Đã đăng ký thành công ${commands.length} lệnh toàn cục (Global Commands).`);
    }
  } catch (error) {
    logger.error('Lỗi khi đăng ký lệnh:', error);
  }
}

deployCommands();
