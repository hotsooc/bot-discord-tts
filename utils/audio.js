const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const fs = require('fs');
const fsp = require('fs').promises;
const https = require('https');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

const connections = new Map();
const ttsQueue = [];
let isProcessing = false;

// Queue TTS
async function queueTTS(interaction, text, voiceChannel) {
  if (ttsQueue.length >= 10) {
    await interaction.reply({ content: '❌ Hàng đợi TTS đã đầy. Vui lòng thử lại sau.', ephemeral: true });
    return;
  }
  const speaker = interaction.member?.displayName || interaction.user.username;
  const fullText = `${speaker} nói: ${text}`;
  ttsQueue.push({ interaction, fullText, voiceChannel });
  await processQueue();
}

// Play sound
async function playSound(interaction, soundFile, voiceChannel, soundType = 'soundboard') {
  const connection = await ensureConnection(interaction, voiceChannel);
  if (!connection) return;

  let soundPath;
  if (soundType === 'greeting') {
    soundPath = path.join(__dirname, '../assets/join', path.basename(soundFile));
  } else if (soundType === 'leave') {
    soundPath = path.join(__dirname, '../assets/leave', path.basename(soundFile));
  } else {
    soundPath = path.join(__dirname, '../assets/soundboard', path.basename(soundFile));
  }

  try {
    await fsp.access(soundPath);
    const player = createAudioPlayer();
    const resource = createAudioResource(fs.createReadStream(soundPath));
    player.play(resource);
    connection.subscribe(player);

    player.on('error', error => {
      logger.error(`Lỗi phát âm thanh ${soundFile}:`, error);
      interaction.followUp({ content: '❌ Lỗi khi phát âm thanh.', ephemeral: true }).catch(() => {});
    });

    return new Promise(resolve => {
      player.on(AudioPlayerStatus.Idle, () => resolve());
    });
  } catch (error) {
    logger.error(`Không tìm thấy hoặc lỗi khi phát tệp ${soundPath}:`, error);
    await interaction.followUp({ content: `❌ Không thể phát âm thanh ${soundFile}.`, ephemeral: true }).catch(() => {});
    return null;
  }
}

// Process TTS queue
async function processQueue() {
  if (isProcessing || ttsQueue.length === 0) return;
  isProcessing = true;
  const { interaction, fullText, voiceChannel } = ttsQueue.shift();

  try {
    const connection = await ensureConnection(interaction, voiceChannel);
    if (!connection) throw new Error('Không thể kết nối voice channel');

    const url = googleTTS.getAudioUrl(fullText, { lang: 'vi', slow: false, host: 'https://translate.google.com' });
    const fileName = `tts-${uuidv4()}.mp3`;
    const filePath = path.join(__dirname, fileName);
    const file = fs.createWriteStream(filePath);

    await new Promise((resolve, reject) => {
      https.get(url, response => {
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', err => reject(err));
      }).on('error', reject);
    });

    const playAudio = file => {
      const player = createAudioPlayer();
      const resource = createAudioResource(fs.createReadStream(file));
      player.play(resource);
      connection.subscribe(player);
      return player;
    };

    const greetingFile = getGreetingFilePath();
    if (!getVoiceConnection(voiceChannel.guild.id)) {
      const greetingPlayer = playAudio(greetingFile);
      greetingPlayer.on(AudioPlayerStatus.Idle, () => {
        const ttsPlayer = playAudio(filePath);
        ttsPlayer.on(AudioPlayerStatus.Idle, async () => {
          await fsp.unlink(filePath).catch(() => {});
          isProcessing = false;
          processQueue();
        });
      });
    } else {
      const ttsPlayer = playAudio(filePath);
      ttsPlayer.on(AudioPlayerStatus.Idle, async () => {
        await fsp.unlink(filePath).catch(() => {});
        isProcessing = false;
        processQueue();
      });
    }
  } catch (error) {
    logger.error('Lỗi xử lý TTS:', error);
    await interaction.followUp({ content: '❌ Lỗi khi xử lý TTS.', ephemeral: true }).catch(() => {});
    isProcessing = false;
    processQueue();
  }
}

// Check connection
async function ensureConnection(interaction, voiceChannel) {
  if (!voiceChannel) {
    await interaction.reply({ content: '🔊 Bạn phải vào kênh voice trước.', ephemeral: true }).catch(() => {});
    return null;
  }

  let connection = getVoiceConnection(interaction.guild.id);

  if (connection && connection.state.status === 'disconnected') {
    connection.destroy();
    connections.delete(interaction.guild.id);
    connection = null;
  }

  // Nếu không có kết nối hợp lệ, tạo mới
  if (!connection) {
    try {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      });
      connections.set(voiceChannel.guild.id, connection);
    } catch (error) {
      logger.error('Lỗi khi kết nối voice:', error);
      await interaction.reply({ content: '❌ Không thể tham gia kênh voice.', ephemeral: true }).catch(() => {});
      return null;
    }
  }

  return connection;
}


function disconnect(guildId) {
  const connection = getVoiceConnection(guildId);
  if (connection) {
    connection.destroy();
    connections.delete(guildId);
  }
}


function getGreetingFilePath() {
  const now = new Date();
  const utc7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const hour = utc7.getUTCHours();
  if (hour >= 6 && hour <= 10) return 'morning.mp3';
  if (hour >= 11 && hour < 18) return 'afternoon.mp3';
  return 'evening.mp3';
}


function getLeaveFilePath() {
  return 'leave.mp3';
}

module.exports = { queueTTS, playSound, processQueue, ensureConnection, disconnect, getGreetingFilePath, getLeaveFilePath };