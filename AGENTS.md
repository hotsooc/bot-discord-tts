# AGENTS.md

## Project

Discord TTS bot using discord.js v14 + @discordjs/voice + Google TTS (Vietnamese). Entry point: `index.js`.

## Setup

```
npm install
```

Requires `.env` with:
- `DISCORD_TOKEN` — bot token
- `CLIENT_ID` — application client ID (for slash command registration)
- `GUILD_ID` — server ID (guild-specific slash commands)

## Commands

| Command | What |
|---------|------|
| `node index.js` | Start the bot |
| `node deploy-commands.js` | Register/reload slash commands with Discord |
| `node check-dave.js` | Diagnose @discordjs/voice native dependencies |

No build step. No linter. No typecheck. `npm test` is a stub — there are no tests.

## Architecture

```
index.js              — loads commands, loads events, starts idle monitor, logs in
events/               — auto-loaded by eventLoader.js (one file = one event)
commands/admin/       — ban, unban, listban (require Leader/Moderator role)
commands/user/        — join, leave, say, soundboard
utils/
  audio.js            — TTS queue, voice effects, sound playback
  commandLoader.js    — loads commands once into a Map on startup
  voiceManager.js     — auto-disconnect after 30 min idle
  logger.js           — Winston daily rotation
  permissions.js       — role/perm checks
  replyUtils.js        — safeReply helper
  eventLoader.js       — auto-loads event handlers
data/                  — blacklist.json (banned user IDs)
assets/                — join/ leave/ soundboard/ (MP3 files)
```

### Command pattern

Every command file exports `data` (SlashCommandBuilder) and `async execute(interaction)`. Commands are loaded once at startup via `commandLoader.js` and cached in a Map — no disk reads per interaction.

### Voice / TTS

All voice logic lives in `utils/audio.js`. Key behaviors:
- TTS queue max 10 items, processed sequentially
- Google TTS is fetched via HTTPS, saved as temp MP3, processed through ffmpeg for voice effects, played, then deleted
- `/say` accepts optional `voice` parameter with 6 presets: mặc định, nhanh, chậm, cao, trầm, robot. Effects applied via ffmpeg audio filters.
- Greeting (`assets/join/`) plays automatically on first join based on time of day (UTC+7): morning (6–10), afternoon (11–17), evening (18–5)
- Soundboard reads `.mp3` files from `assets/soundboard/`, limited to 25 Discord select menu options
- Auto-disconnect after 30 minutes of voice inactivity (`utils/voiceManager.js`)

### Permissions

Server owner and users with Administrator permission bypass all checks. Admin commands additionally require 'Leader' or 'Moderator' role.

### Logging

Winston with daily rotation to `logs/bot-YYYY-MM-DD.log`. Log files are kept for 1 day.

## Adding a new slash command

1. Create `<commandName>.js` in `commands/admin/` or `commands/user/`
2. Export `data` (new SlashCommandBuilder()) and `async execute(interaction)`
3. Run `node deploy-commands.js` to register with Discord
4. Restart the bot

## Code style

- All comments, logs, and user-facing bot messages are in Vietnamese
- Use `utils/permissions.js` `hasPermission()` for permission checks
- Use `utils/replyUtils.js` `safeReply()` for replies that might already be deferred/ephemeral
- Inconsistent reply API usage exists (some files use `flags: MessageFlags.Ephemeral`, others use `ephemeral: true`) — match the surrounding code, do not "fix" it unless asked
