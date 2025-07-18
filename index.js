require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  getVoiceConnection,
} = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); 


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

const connections = new Map();
const ttsQueue = [];
let isProcessing = false;

client.once('ready', () => {
  console.log(`✅ Bot đã đăng nhập với tên: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!say')) return;

  const text = message.content.slice(5).trim();
  if (!text) return message.reply('❗ Bạn cần nhập nội dung.');

  const speaker = message.member?.displayName || message.author.username;
  const fullText = `${speaker} nói: ${text}`;
  const voiceChannel = message.member.voice.channel;

  if (!voiceChannel) return message.reply('🔊 Bạn phải vào kênh voice trước.');

  ttsQueue.push({ message, fullText, voiceChannel });
  processQueue();
});


async function processQueue() {
  if (isProcessing || ttsQueue.length === 0) return;

  isProcessing = true;
  const { message, fullText, voiceChannel } = ttsQueue.shift();

  try {
    const url = googleTTS.getAudioUrl(fullText, {
      lang: 'vi',
      slow: false,
      host: 'https://translate.google.com',
    });

    // Create a unique file name
    const fileName = `tts-${uuidv4()}.mp3`;
    const filePath = path.join(__dirname, fileName);
    const file = fs.createWriteStream(filePath);

    https.get(url, (response) => {
      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          let connection = getVoiceConnection(voiceChannel.guild.id);
          let PlayGreeting = false;
          if (!connection) {
            connection = joinVoiceChannel({
              channelId: voiceChannel.id,
              guildId: voiceChannel.guild.id,
              adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });
            connections.set(voiceChannel.guild.id, connection);
            PlayGreeting = true;
          }
          const playTTS = () => {
            const ttsPlayer = createAudioPlayer();
            const ttsResource = createAudioResource(fs.createReadStream(filePath));
            ttsPlayer.play(ttsResource);
            connection.subscribe(ttsPlayer);

            ttsPlayer.on(AudioPlayerStatus.Idle, () => {
              fs.unlink(filePath, () => {});
              isProcessing = false;
              processQueue();
            });
          };

          if (PlayGreeting) { 
            const greetingFile = getGreetingFilePath();
            const greetingPlayer = createAudioPlayer();
            const greetingResource = createAudioResource(fs.createReadStream(greetingFile));
            greetingPlayer.play(greetingResource);
            connection.subscribe(greetingPlayer);

            greetingPlayer.on(AudioPlayerStatus.Idle, playTTS);
            greetingPlayer.on('error', (error) => {
              console.error('Lỗi khi phát greeting:', error);
              playTTS(); 
            });
          } else {
            playTTS(); 
          }
        });
      });

      file.on('error', (err) => {
        console.error('Lỗi ghi file:', err);
        isProcessing = false;
        processQueue();
      });
    });
  } catch (err) {
    console.error('Lỗi xử lý TTS:', err);
    isProcessing = false;
    processQueue();
  }
}


// Lệnh rời khỏi voice
client.on('messageCreate', async (message) => {
  if (message.content === '!leave') {
    const connection = getVoiceConnection(message.guild.id);
    if (connection) {
      connection.destroy();
      connections.delete(message.guild.id);
      message.reply('👋 Bot đã rời khỏi voice channel.');
    } else {
      message.reply('❌ Bot không ở trong voice channel.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

function getGreetingFilePath() {
  const now = new Date();
  const utc7 = new Date(now.getTime() + 7 * 60 * 60 * 1000); 
  const hour = utc7.getUTCHours();

  if (hour >= 6 && hour <= 10) {
    return path.join(__dirname, 'audio', 'morning.mp3');
  } else if (hour >= 11 && hour < 18) {
    return path.join(__dirname, 'audio', 'afternoon.mp3');
  } else {
    return path.join(__dirname, 'audio', 'evening.mp3');
  }
}