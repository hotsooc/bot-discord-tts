const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  getVoiceConnection, AudioPlayerStatus, StreamType
} = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const fs = require('fs');
const fsp = require('fs').promises;
const https = require('https');
const path = require('path');
const { execFile } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const ffmpegPath = require('ffmpeg-static');
const { touchActivity } = require('./voiceManager');

const connections = new Map();
const ttsQueue = [];
let isProcessing = false;

// ─── Voice effect presets using ffmpeg ───────────────────────────
const VOICE_PRESETS = {
  macdinh: null,
  nhanh: ['-filter:a', 'atempo=1.4'],
  cham: ['-filter:a', 'atempo=0.7'],
  cao: ['-filter:a', 'asetrate=44100*1.45,atempo=1.45,aresample=44100'],
  tram: ['-filter:a', 'asetrate=44100*0.7,atempo=0.7,aresample=44100'],
  robot: ['-filter:a', 'aecho=0.8:0.88:60:0.4,aecho=0.8:0.88:120:0.3'],
};

function getVoiceFilter(voiceType) {
  return VOICE_PRESETS[voiceType] || null;
}

const VOICE_CHOICES = [
  { name: '🔊 Mặc định', value: 'macdinh' },
  { name: '⚡ Nhanh', value: 'nhanh' },
  { name: '🐌 Chậm', value: 'cham' },
  { name: '👧 Cao (chipmunk)', value: 'cao' },
  { name: '🧓 Trầm', value: 'tram' },
  { name: '🤖 Robot', value: 'robot' },
];

// ─── Apply ffmpeg voice filter ────────────────────────────────────
function applyVoiceEffect(inputPath, outputPath, voiceType) {
  if (voiceType === 'macdinh') {
    return fsp.rename(inputPath, outputPath);
  }

  const filter = getVoiceFilter(voiceType);
  if (!filter) {
    return fsp.rename(inputPath, outputPath);
  }

  return new Promise((resolve, reject) => {
    const args = ['-i', inputPath, ...filter, '-q:a', '5', '-y', outputPath];
    const ffmpeg = execFile(ffmpegPath, args, { timeout: 15000 });

    let stderr = '';
    ffmpeg.stderr.on('data', d => { stderr += d.toString(); });

    ffmpeg.on('close', async code => {
      if (code === 0) {
        await fsp.unlink(inputPath).catch(() => {});
        resolve();
      } else {
        logger.error(`ffmpeg exit code ${code}: ${stderr.slice(-200)}`);
        await fsp.unlink(inputPath).catch(() => {});
        await fsp.rename(inputPath, outputPath).catch(() => {});
        resolve();
      }
    });

    ffmpeg.on('error', async err => {
      logger.error(`ffmpeg error: ${err.message}`);
      await fsp.unlink(inputPath).catch(() => {});
      await fsp.rename(inputPath, outputPath).catch(() => {});
      resolve();
    });
  });
}

// ─── Queue TTS ─────────────────────────────────────────────────────
async function queueTTS(interaction, text, voiceChannel, voice = 'macdinh') {
  if (ttsQueue.length >= 10) {
    await interaction.reply({
      content: '❌ Hàng đợi TTS đã đầy (tối đa 10). Vui lòng thử lại sau.',
      ephemeral: true,
    });
    return;
  }
  const speaker = interaction.member?.displayName || interaction.user.username;
  const fullText = `${speaker} nói: ${text}`;
  ttsQueue.push({ interaction, fullText, voiceChannel, voice });
  await processQueue();
}

// ─── Play sound ────────────────────────────────────────────────────
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
    touchActivity(voiceChannel.guild.id);

    player.on('error', error => {
      logger.error(`Lỗi phát âm thanh ${soundFile}:`, error);
      interaction.followUp({ content: '❌ Lỗi khi phát âm thanh.', ephemeral: true }).catch(() => {});
    });

    return new Promise(resolve => {
      player.on(AudioPlayerStatus.Idle, () => resolve());
    });
  } catch (error) {
    logger.error(`Không tìm thấy tệp ${soundPath}:`, error);
    await interaction.followUp({ content: `❌ Không thể phát âm thanh ${soundFile}.`, ephemeral: true }).catch(() => {});
    return null;
  }
}

// ─── Process TTS queue ─────────────────────────────────────────────
async function processQueue() {
  if (isProcessing || ttsQueue.length === 0) return;
  isProcessing = true;
  const { interaction, fullText, voiceChannel, voice } = ttsQueue.shift();

  try {
    const connection = await ensureConnection(interaction, voiceChannel);
    if (!connection) throw new Error('Không thể kết nối voice channel');
    touchActivity(voiceChannel.guild.id);

    const url = googleTTS.getAudioUrl(fullText, {
      lang: 'vi',
      slow: false,
      host: 'https://translate.google.com',
    });

    const rawFile = path.join(__dirname, `tts_raw_${uuidv4()}.mp3`);
    const finalFile = path.join(__dirname, `tts_${uuidv4()}.mp3`);

    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(rawFile);
      https.get(url, response => {
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }).on('error', reject);
    });

    await applyVoiceEffect(rawFile, finalFile, voice);

    const playAudio = (filePath) => {
      const player = createAudioPlayer();
      const resource = createAudioResource(fs.createReadStream(filePath), {
        inputType: StreamType.Arbitrary,
      });
      player.play(resource);
      connection.subscribe(player);
      return player;
    };

    const greetingFile = path.join(__dirname, '../assets/join', getGreetingFilePath());

    const onTtsDone = async () => {
      await fsp.unlink(finalFile).catch(() => {});
      isProcessing = false;
      processQueue();
    };

    if (!getVoiceConnection(voiceChannel.guild.id)) {
      const greetingPlayer = playAudio(greetingFile);
      greetingPlayer.on(AudioPlayerStatus.Idle, () => {
        const ttsPlayer = playAudio(finalFile);
        ttsPlayer.on(AudioPlayerStatus.Idle, onTtsDone);
      });
    } else {
      const ttsPlayer = playAudio(finalFile);
      ttsPlayer.on(AudioPlayerStatus.Idle, onTtsDone);
    }
  } catch (error) {
    logger.error('Lỗi xử lý TTS:', error);
    await interaction.followUp({ content: '❌ Lỗi khi xử lý TTS.', ephemeral: true }).catch(() => {});
    isProcessing = false;
    processQueue();
  }
}

// ─── Connection management ─────────────────────────────────────────
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

// ─── Greeting / Leave paths ────────────────────────────────────────
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

module.exports = {
  queueTTS, playSound, processQueue, ensureConnection,
  disconnect, getGreetingFilePath, getLeaveFilePath,
  getVoiceFilter, VOICE_CHOICES,
};
