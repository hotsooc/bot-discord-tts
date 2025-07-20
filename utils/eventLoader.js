const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');


async function loadEvents(client) {
  const eventFiles = await fs.readdir(path.join(__dirname, '../events'));
  for (const file of eventFiles.filter(f => f.endsWith('.js'))) {
    const event = require(path.join(__dirname, '../events', file));
    client.on(event.name, (...args) => event.execute(...args));
    logger.info(`Loaded event: ${event.name}`);
  }
}

module.exports = { loadEvents };