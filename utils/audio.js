const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  getVoiceConnection, AudioPlayerStatus, StreamType,
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

// Thư mục lưu file tạm âm thanh
const TEMP_DIR = path.join(__dirname, '../temp');

// Quản lý hàng đợi và trạng thái phát riêng cho từng Guild
const guildStates = new Map();

function getGuildState(guildId) {
  if (!guildStates.has(guildId)) {
    guildStates.set(guildId, {
      queue: [],
      isProcessing: false,
      player: null,
      currentFiles: [],
      skipFlag: false,
    });
  }
  return guildStates.get(guildId);
}

// Khởi tạo và dọn dẹp thư mục temp khi khởi động
(async () => {
  try {
    await fsp.mkdir(TEMP_DIR, { recursive: true });
    const files = await fsp.readdir(TEMP_DIR);
    for (const file of files) {
      if (file.endsWith('.mp3')) {
        await fsp.unlink(path.join(TEMP_DIR, file)).catch(() => {});
      }
    }
  } catch (err) {
    logger.error('Lỗi khi dọn dẹp thư mục temp:', err);
  }
})();

// ─── Voice effect presets using ffmpeg ───────────────────────────
const VOICE_PRESETS = {
  macdinh: null,
  nhanh: ['-filter:a', 'atempo=1.4'],
  cham: ['-filter:a', 'atempo=0.75'],
  cao: ['-filter:a', 'asetrate=44100*1.4,atempo=1.4,aresample=44100'],
  tram: ['-filter:a', 'asetrate=44100*0.75,atempo=0.75,aresample=44100'],
  robot: ['-filter:a', 'aecho=0.8:0.88:60:0.4,aecho=0.8:0.88:120:0.3'],
};

const VOICE_CHOICES = [
  { name: '🔊 Mặc định', value: 'macdinh' },
  { name: '⚡ Nhanh', value: 'nhanh' },
  { name: '🐌 Chậm', value: 'cham' },
  { name: '👧 Cao (chipmunk)', value: 'cao' },
  { name: '🧓 Trầm', value: 'tram' },
  { name: '🤖 Robot', value: 'robot' },
];

function getVoiceFilter(voiceType) {
  return VOICE_PRESETS[voiceType] || null;
}

// ─── Text Sanitizer ──────────────────────────────────────────────
function sanitizeText(text) {
  return text
    // Thay thế URL bằng thông báo gọn
    .replace(/https?:\/\/\S+/gi, ' đường liên kết ')
    // Chuyển emoji tùy biến Discord <:ten:id> thành :ten:
    .replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, ' $1 ')
    // Bỏ tag user, role, channel
    .replace(/<@!?\d+>/g, ' bạn ')
    .replace(/<@&\d+>/g, ' vai trò ')
    .replace(/<#\d+>/g, ' kênh ')
    // Rút gọn ký tự lặp vô nghĩa (ví dụ: aaaaaaaa -> aaa)
    .replace(/(.)\1{3,}/g, '$1$1$1')
    .trim();
}

// ─── Tải audio từ danh sách URL (hỗ trợ câu dài) ─────────────────
async function downloadAudioChunks(urls, outputPath) {
  const writeStream = fs.createWriteStream(outputPath);

  for (const item of urls) {
    await new Promise((resolve, reject) => {
      https.get(item.url, response => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          https.get(response.headers.location, redirectRes => {
            redirectRes.pipe(writeStream, { end: false });
            redirectRes.on('end', resolve);
            redirectRes.on('error', reject);
          }).on('error', reject);
          return;
        }
        response.pipe(writeStream, { end: false });
        response.on('end', resolve);
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  writeStream.end();
  await new Promise(resolve => writeStream.on('finish', resolve));
}

// ─── Apply ffmpeg voice filter ────────────────────────────────────
function applyVoiceEffect(inputPath, outputPath, voiceType) {
  const filter = getVoiceFilter(voiceType);
  if (!filter) {
    return fsp.rename(inputPath, outputPath);
  }

  return new Promise((resolve) => {
    const args = ['-i', inputPath, ...filter, '-q:a', '5', '-y', outputPath];
    const ffmpeg = execFile(ffmpegPath, args, { timeout: 15000 });

    let stderr = '';
    ffmpeg.stderr.on('data', d => { stderr += d.toString(); });

    ffmpeg.on('close', async code => {
      await fsp.unlink(inputPath).catch(() => {});
      if (code !== 0) {
        logger.error(`ffmpeg exit code ${code}: ${stderr.slice(-200)}`);
        await fsp.rename(inputPath, outputPath).catch(() => {});
      }
      resolve();
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
  const guildId = voiceChannel.guild.id;
  const state = getGuildState(guildId);

  if (state.queue.length >= 15) {
    await interaction.reply({
      content: '❌ Hàng đợi TTS của máy chủ đã đầy (tối đa 15). Vui lòng thử lại sau.',
      ephemeral: true,
    });
    return false;
  }

  const cleanedText = sanitizeText(text);
  if (!cleanedText) {
    await interaction.reply({
      content: '❌ Nội dung tin nhắn không hợp lệ sau khi lọc.',
      ephemeral: true,
    });
    return false;
  }

  // Giới hạn độ dài tối đa 500 ký tự để tránh spam
  const truncatedText = cleanedText.length > 500
    ? cleanedText.slice(0, 497) + '...'
    : cleanedText;

  const speaker = interaction.member?.displayName || interaction.user.username;
  const fullText = `${speaker} nói: ${truncatedText}`;

  state.queue.push({
    interaction,
    text: truncatedText,
    fullText,
    voiceChannel,
    voice,
  });

  processGuildQueue(guildId);
  return true;
}

// ─── Skip & Stop controls ─────────────────────────────────────────
function skipTTS(guildId) {
  const state = getGuildState(guildId);
  if (state.player && state.isProcessing) {
    state.skipFlag = true;
    state.player.stop(true);
    return true;
  }
  return false;
}

function stopTTS(guildId) {
  const state = getGuildState(guildId);
  state.queue = [];
  if (state.player) {
    state.player.stop(true);
  }
  state.isProcessing = false;
  // Xóa các file tạm đang giữ nếu có
  for (const f of state.currentFiles) {
    fsp.unlink(f).catch(() => {});
  }
  state.currentFiles = [];
}

function getQueue(guildId) {
  const state = getGuildState(guildId);
  return state.queue;
}

// ─── Process TTS queue for a specific Guild ───────────────────────
async function processGuildQueue(guildId) {
  const state = getGuildState(guildId);
  if (state.isProcessing || state.queue.length === 0) return;

  state.isProcessing = true;
  const currentTask = state.queue.shift();
  const { interaction, fullText, voiceChannel, voice } = currentTask;

  const rawFile = path.join(TEMP_DIR, `tts_raw_${uuidv4()}.mp3`);
  const finalFile = path.join(TEMP_DIR, `tts_${uuidv4()}.mp3`);
  state.currentFiles = [rawFile, finalFile];

  try {
    const { connection, isNew } = await ensureConnection(interaction, voiceChannel);
    if (!connection) throw new Error('Không thể kết nối voice channel');
    touchActivity(guildId);

    // Lấy URL TTS từ Google (chia nhỏ tự động nếu text dài)
    const audioUrls = googleTTS.getAllAudioUrls(fullText, {
      lang: 'vi',
      slow: false,
      host: 'https://translate.google.com',
    });

    await downloadAudioChunks(audioUrls, rawFile);
    await applyVoiceEffect(rawFile, finalFile, voice);

    // Tạo player nếu chưa có
    if (!state.player) {
      state.player = createAudioPlayer();
      connection.subscribe(state.player);
    }

    const playFile = (filePath) => {
      return new Promise((resolve) => {
        const resource = createAudioResource(fs.createReadStream(filePath), {
          inputType: StreamType.Arbitrary,
        });

        const onIdle = () => {
          cleanupListeners();
          resolve();
        };

        const onError = (err) => {
          logger.error('Lỗi AudioPlayer:', err);
          cleanupListeners();
          resolve();
        };

        const cleanupListeners = () => {
          state.player.off(AudioPlayerStatus.Idle, onIdle);
          state.player.off('error', onError);
        };

        state.player.once(AudioPlayerStatus.Idle, onIdle);
        state.player.once('error', onError);
        state.player.play(resource);
        touchActivity(guildId);
      });
    };

    // Nếu là kết nối mới, phát âm thanh chào trước
    if (isNew) {
      const greetingPath = path.join(__dirname, '../assets/join', getGreetingFilePath());
      try {
        await fsp.access(greetingPath);
        await playFile(greetingPath);
      } catch {
        // bỏ qua nếu file greeting không tồn tại
      }
    }

    // Phát TTS
    await playFile(finalFile);

  } catch (error) {
    logger.error(`Lỗi xử lý TTS ở guild ${guildId}:`, error);
  } finally {
    // Dọn dẹp file tạm
    await fsp.unlink(rawFile).catch(() => {});
    await fsp.unlink(finalFile).catch(() => {});
    state.currentFiles = [];
    state.isProcessing = false;

    // Tiếp tục bài tiếp theo trong hàng đợi
    if (state.queue.length > 0) {
      processGuildQueue(guildId);
    }
  }
}

// ─── Play sound (Soundboard / Join / Leave) ─────────────────────────
async function playSound(interaction, soundFile, voiceChannel, soundType = 'soundboard') {
  const { connection } = await ensureConnection(interaction, voiceChannel);
  if (!connection) return null;

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
    const state = getGuildState(voiceChannel.guild.id);
    if (!state.player) {
      state.player = createAudioPlayer();
      connection.subscribe(state.player);
    }

    const resource = createAudioResource(fs.createReadStream(soundPath));
    state.player.play(resource);
    touchActivity(voiceChannel.guild.id);

    return new Promise(resolve => {
      const onIdle = () => {
        state.player.off(AudioPlayerStatus.Idle, onIdle);
        resolve();
      };
      state.player.once(AudioPlayerStatus.Idle, onIdle);
    });
  } catch (error) {
    logger.error(`Không tìm thấy hoặc không thể phát tệp ${soundPath}:`, error);
    return null;
  }
}

// ─── Connection management ─────────────────────────────────────────
async function ensureConnection(interaction, voiceChannel) {
  if (!voiceChannel) {
    return { connection: null, isNew: false };
  }

  const guildId = voiceChannel.guild.id;
  let connection = getVoiceConnection(guildId);
  let isNew = false;

  if (connection && connection.state.status === 'disconnected') {
    connection.destroy();
    connection = null;
  }

  if (!connection) {
    try {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      });
      isNew = true;
    } catch (error) {
      logger.error('Lỗi khi kết nối voice:', error);
      return { connection: null, isNew: false };
    }
  }

  return { connection, isNew };
}

function disconnect(guildId) {
  const connection = getVoiceConnection(guildId);
  if (connection) {
    connection.destroy();
  }
  const state = getGuildState(guildId);
  stopTTS(guildId);
  guildStates.delete(guildId);
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
  queueTTS,
  playSound,
  skipTTS,
  stopTTS,
  getQueue,
  ensureConnection,
  disconnect,
  getGreetingFilePath,
  getLeaveFilePath,
  getVoiceFilter,
  VOICE_CHOICES,
};
