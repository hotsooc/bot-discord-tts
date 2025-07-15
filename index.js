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
//const ALLOWED_GUILD_ID = '123456789012345678';
const connections = new Map();

client.once('ready', () => {
  console.log(`✅ Bot đã đăng nhập với tên: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!say')) return;
  //if (message.guild?.id !== ALLOWED_GUILD_ID) return;
  const text = message.content.slice(5).trim();
  if (!text) return message.reply('Bạn cần nhập nội dung.');

  const speaker = message.member?.displayName || message.author.username;
  const fullText = `${speaker} nói: ${text}`;
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return message.reply('Bạn phải vào kênh voice trước.');

  const url = googleTTS.getAudioUrl(fullText, {
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
        let connection = getVoiceConnection(voiceChannel.guild.id);

        if (!connection) {
          connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
          });

          const greetingFile = getGreetingFilePath();
          const greetingResource = createAudioResource(fs.createReadStream(greetingFile));
          const greetingPlayer = createAudioPlayer();

          greetingPlayer.play(greetingResource);
          connection.subscribe(greetingPlayer);

          greetingPlayer.on(AudioPlayerStatus.Idle, () => {
            const ttsResource = createAudioResource(fs.createReadStream(filePath));
            const ttsPlayer = createAudioPlayer();
            ttsPlayer.play(ttsResource);
            connection.subscribe(ttsPlayer);

            ttsPlayer.on(AudioPlayerStatus.Idle, () => {
              fs.unlinkSync(filePath);
            });
          });

          connections.set(voiceChannel.guild.id, connection);
        } else {
          const resource = createAudioResource(fs.createReadStream(filePath));
          const player = createAudioPlayer();
          player.play(resource);
          connection.subscribe(player);

          player.on(AudioPlayerStatus.Idle, () => {
            fs.unlinkSync(filePath);
          });
        }
      });
    });
  });
});

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
