# Manora — Discord Music Bot

Discord bot เล่นเพลงจาก YouTube — วางลิงค์หรือพิมพ์ชื่อเพลงก็ได้ เล่นต่อเนื่องตามคิว ไม่มี ads (ดึง audio stream ตรงผ่าน yt-dlp ไม่ผ่านหน้าเว็บ)

## Features

- **เล่นจากลิงค์ YouTube** — ทั้งเพลงเดียวและ playlist (เพิ่มเข้าคิวทั้งชุด)
- **ค้นหาด้วยชื่อเพลง** — พิมพ์ชื่อเพลงแล้วเล่นผลการค้นหาอันดับแรกจาก YouTube
- **คิวเพลง** — เพิ่ม/ลบ/สลับลำดับ/ดูคิว เล่นต่อเนื่องอัตโนมัติ
- **โหมดวน** — วนเพลงเดียว หรือวนทั้งคิว
- **ปรับเสียง** — 0–200% มีผลทันที
- **ออกจากห้องอัตโนมัติ** — เมื่อคิวว่างเกิน 5 นาที

---

## Tech Stack

| Layer | Technology |
|:---|:---|
| Runtime | Node.js 22 (ESM) |
| Discord | discord.js v14 + @discordjs/voice |
| Audio source | yt-dlp (stream ตรงจาก YouTube) |
| Audio encode | ffmpeg → Ogg/Opus |
| Deployment | Docker / Portainer |

---

## Slash Commands

| Command | คำอธิบาย |
|:---|:---|
| `/play <query>` | เล่นเพลงจากลิงค์ YouTube / ลิงค์ playlist / ชื่อเพลง |
| `/skip` | ข้ามเพลงปัจจุบัน |
| `/stop` | หยุดเล่น ล้างคิว และออกจากห้อง |
| `/pause` / `/resume` | พัก / เล่นต่อ |
| `/queue` | ดูคิวเพลง |
| `/nowplaying` | ดูเพลงที่กำลังเล่น + เวลาที่เล่นไปแล้ว |
| `/shuffle` | สลับลำดับเพลงในคิว |
| `/loop <mode>` | โหมดวน: ปิด / วนเพลงเดียว / วนทั้งคิว |
| `/remove <position>` | ลบเพลงออกจากคิวตามลำดับ |
| `/volume <percent>` | ปรับระดับเสียง 0–200% |

---

## Setup

### 1. สร้าง Discord Application

1. ไปที่ [Discord Developer Portal](https://discord.com/developers/applications) → New Application ชื่อ **Manora**
2. แท็บ **Bot** → Reset Token → เก็บเป็น `DISCORD_TOKEN`
3. แท็บ **General Information** → Application ID → เก็บเป็น `DISCORD_CLIENT_ID`
4. Invite bot เข้า server: แท็บ **OAuth2 → URL Generator** เลือก scope `bot` + `applications.commands` และ permission `Connect`, `Speak`, `Send Messages`

### 2. ติดตั้ง dependencies

```bash
npm install
```

Dev บนเครื่องต้องมี `yt-dlp` และ `ffmpeg` ใน PATH (หรือตั้ง `YTDLP_PATH` / `FFMPEG_PATH` ใน `.env`) — production ใน Docker มีให้แล้ว

### 3. ตั้งค่า environment

```bash
cp .env.example .env
```

| Variable | Required | คำอธิบาย |
|:---|:---:|:---|
| `DISCORD_TOKEN` | yes | Bot token จาก Discord Developer Portal |
| `DISCORD_CLIENT_ID` | yes | Application ID |
| `DISCORD_GUILD_ID` | yes | Server ID |
| `YTDLP_PATH` | no | Path ไปยัง yt-dlp (default: หาใน PATH) |
| `FFMPEG_PATH` | no | Path ไปยัง ffmpeg (default: หาใน PATH) |

### 4. ลงทะเบียน slash commands

```bash
npm run deploy
```

ทำครั้งแรกครั้งเดียว (และทุกครั้งที่แก้รายการคำสั่งใน `src/bot/commands.js`)

### 5. รัน bot

```bash
npm run dev    # development (nodemon)
npm start      # production
```

---

## Scripts

| Command | Action |
|:---|:---|
| `npm start` | Start bot (production) |
| `npm run dev` | Start bot with auto-reload (nodemon) |
| `npm run deploy` | Register slash commands with Discord |

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
│   ├── index.js              Player per guild — คิว, loop, volume, auto-disconnect
│   ├── ytdlp.js              Resolve ลิงค์/ค้นหา → รายการ track (yt-dlp -J)
│   └── stream.js             yt-dlp → ffmpeg → Ogg/Opus stream
└── utils/format.js           Format เวลาเพลง (m:ss)
```

---

## Infrastructure

Bot deploy บน VM `app` (192.168.1.14) ผ่าน Portainer — ไม่ต้องเปิด port (bot ต่อออกหา Discord อย่างเดียว)

### หมายเหตุเรื่อง yt-dlp

YouTube เปลี่ยนระบบบ่อย ถ้าเพลงเริ่มเล่นไม่ได้ (yt-dlp error ใน log) ให้ **rebuild image ใหม่** — Dockerfile ดึง yt-dlp เวอร์ชันล่าสุดตอน build เสมอ
