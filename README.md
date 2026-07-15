# Manora — Discord Music Bot

A Discord bot that plays music from YouTube. Just paste a link or type a song name. It features continuous queue playback with zero ads (pulls the audio stream directly via yt-dlp, bypassing the web interface).

## Features

- **Play from YouTube Links** — Supports both single tracks and playlists (adds the entire playlist to the queue).
- **Search by Song Name** — Type a song name to play the top search result from YouTube.
- **Queue Management** — Add, remove, shuffle, and view the queue with automatic continuous playback.
- **Loop Modes** — Loop a single song or the entire queue.
- **Volume Control** — Adjust volume from 0–200% with instant effect.
- **Auto-Disconnect** — Automatically leaves the voice channel if the queue remains empty for more than 5 minutes.

---

## Tech Stack

| Layer        | Technology                          |
| ------------ | ----------------------------------- |
| Runtime      | Node.js 22 (ESM)                    |
| Discord      | discord.js v14 + @discordjs/voice   |
| Audio source | yt-dlp (Direct stream from YouTube) |
| Audio encode | ffmpeg → Ogg/Opus                   |
| Deployment   | Docker / Portainer                  |

---

## Slash Commands

| Command              | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| `/play <query>`      | Play music from a YouTube link, playlist link, or song name |
| `/skip`              | Skip the current song                                       |
| `/stop`              | Stop playing, clear the queue, and leave the voice channel  |
| `/pause` / `/resume` | Pause / Resume playback                                     |
| `/queue`             | View the music queue                                        |
| `/nowplaying`        | View the currently playing song and elapsed time            |
| `/shuffle`           | Shuffle songs in the queue                                  |
| `/loop <mode>`       | Loop mode: Off / Single track / Entire queue                |
| `/remove <position>` | Remove a song from the queue by its position                |
| `/volume <percent>`  | Adjust volume level from 0–200%                             |

---

## Setup

### 1. Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → New Application named **Manora**.
2. **Bot** tab → Reset Token → Save it as `DISCORD_TOKEN`.
3. **General Information** tab → Application ID → Save it as `DISCORD_CLIENT_ID`.
4. Invite the bot to your server: Go to the **OAuth2 → URL Generator** tab, select the `bot` + `applications.commands` scopes, and check the `Connect`, `Speak`, and `Send Messages` permissions.

### 2. Install Dependencies

```bash
npm install

```

For local development, you must have `yt-dlp` and `ffmpeg` installed in your PATH (or set `YTDLP_PATH` / `FFMPEG_PATH` in your `.env` file). Production builds via Docker already include them.

### 3. Set Up Environment Variables

```bash
cp .env.example .env

```

| Variable            | Required | Description                                 |
| ------------------- | -------- | ------------------------------------------- |
| `DISCORD_TOKEN`     | yes      | Bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | yes      | Application ID                              |
| `DISCORD_GUILD_ID`  | yes      | Server ID                                   |
| `YTDLP_PATH`        | no       | Path to yt-dlp (default: searches in PATH)  |
| `FFMPEG_PATH`       | no       | Path to ffmpeg (default: searches in PATH)  |

### 4. Register Slash Commands

```bash
npm run deploy

```

Run this once during the initial setup (and every time you modify the command list in `src/bot/commands.js`).

### 5. Run the Bot

```bash
npm run dev    # development (nodemon)
npm start      # production

```

---

## Scripts

| Command          | Action                                   |
| ---------------- | ---------------------------------------- |
| `npm start`      | Start the bot (production)               |
| `npm run dev`    | Start the bot with auto-reload (nodemon) |
| `npm run deploy` | Register slash commands with Discord     |

---

## Project Structure

```
src/
├── index.js                  Entry point
├── bot/
│   ├── index.js              Discord client
│   ├── commands.js           Slash command definitions
│   ├── deploy-commands.js    Slash command registration
│   └── handlers/
│       └── interaction.js    Slash command handler
├── player/
│   ├── index.js              Player per guild — queue, loop, volume, auto-disconnect
│   ├── ytdlp.js              Resolve link/search → track list (yt-dlp -J)
│   └── stream.js             yt-dlp → ffmpeg → Ogg/Opus stream
└── utils/format.js           Song time formatting (m:ss)

```

---

### Notes on yt-dlp

YouTube frequently changes its system. If songs fail to play (`yt-dlp error` in the logs), **restart the container**. Every time the bot starts, it runs `yt-dlp -U` to automatically update itself to the latest version. If restarting doesn't fix it, a new yt-dlp patch hasn't been released yet; wait a day or two and restart it again.
