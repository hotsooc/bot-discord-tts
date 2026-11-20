const { Events } = require('discord.js');
const { handleVoiceStateUpdate } = require('../utils/voiceManager');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    try {
      await handleVoiceStateUpdate(oldState, newState);
    } catch (error) {
      // Bỏ qua lỗi ngầm
    }
  },
};
