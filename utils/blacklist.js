const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

const dataDir = path.join(__dirname, '../data');
const filePath = path.join(dataDir, 'blacklist.json');

const bannedUsers = new Set();
let isInitialized = false;

async function init() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed.banned)) {
      parsed.banned.forEach(id => bannedUsers.add(id));
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      await save();
    } else {
      logger.error('Lỗi khi đọc blacklist.json:', err);
    }
  }
  isInitialized = true;
  logger.info(`Đã nạp ${bannedUsers.size} người dùng bị cấm vào bộ nhớ cache`);
}

async function save() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    const payload = { banned: Array.from(bannedUsers) };
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    logger.error('Lỗi khi lưu blacklist.json:', err);
    throw err;
  }
}

function isBanned(userId) {
  return bannedUsers.has(userId);
}

async function ban(userId) {
  if (bannedUsers.has(userId)) return false;
  bannedUsers.add(userId);
  await save();
  return true;
}

async function unban(userId) {
  if (!bannedUsers.has(userId)) return false;
  bannedUsers.delete(userId);
  await save();
  return true;
}

function getBannedList() {
  return Array.from(bannedUsers);
}

// Tự khởi tạo khi nạp module
init().catch(err => logger.error('Khởi tạo blacklist thất bại:', err));

module.exports = {
  init,
  isBanned,
  ban,
  unban,
  getBannedList,
};
