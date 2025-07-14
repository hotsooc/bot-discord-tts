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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

// Dùng map để lưu connection theo guild
const connections = new Map();

client.once('ready', () => {
  console.log(`✅ Bot đã đăng nhập với tên: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!say')) return;

  const text = message.content.slice(5).trim();
  if (!text) return message.reply('Bạn cần nhập nội dung.');

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return message.reply('Bạn phải vào kênh voice trước.');

  const url = googleTTS.getAudioUrl(text, {
    lang: 'vi',
    slow: false,
    host: 'https://translate.google.com',
  });

  const filePath = path.join(__dirname, 'tts.mp3');
  const file = fs.createWriteStream(filePath);

  https.get(url, (response) => {
    response.pipe(file);
    file.on('finish', () => {
      file.close(() => {
        // Nếu chưa có kết nối, tạo mới
        let connection = getVoiceConnection(voiceChannel.guild.id);
        if (!connection) {
          connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
          });

          // Lưu kết nối
          connections.set(voiceChannel.guild.id, connection);
        }

        const resource = createAudioResource(fs.createReadStream(filePath));
        const player = createAudioPlayer();
        player.play(resource);
        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => {
          fs.unlinkSync(filePath);
          // Không destroy() nữa
        });
      });
    });
  });
});

// Thêm lệnh !leave để rời khỏi voice khi cần
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
