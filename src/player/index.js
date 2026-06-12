import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  entersState,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
  NoSubscriberBehavior,
} from '@discordjs/voice';
import { EmbedBuilder } from 'discord.js';
import { createTrackStream } from './stream.js';
import { getRelatedTrack, videoIdFromUrl } from './ytdlp.js';
import { fmtDuration } from '../utils/format.js';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // ไม่มีเพลงในคิว 5 นาที → ออกจากห้อง

const players = new Map(); // guildId → GuildPlayer

export function getPlayer(guildId, textChannel) {
  let player = players.get(guildId);
  if (!player) {
    player = new GuildPlayer(guildId);
    players.set(guildId, player);
  }
  if (textChannel) player.textChannel = textChannel;
  return player;
}

export function peekPlayer(guildId) {
  return players.get(guildId) || null;
}

export function destroyPlayer(guildId) {
  const player = players.get(guildId);
  if (player) {
    player.destroy();
    players.delete(guildId);
  }
}

class GuildPlayer {
  constructor(guildId) {
    this.guildId = guildId;
    this.textChannel = null;
    this.queue = [];
    this.current = null;
    this.loopMode = 'off'; // off | track | queue
    this.autoplay = true; // คิวหมดแล้วหาเพลงที่เกี่ยวข้องเล่นต่อเอง
    this.history = []; // id เพลงที่เล่นล่าสุด ไว้กัน autoplay วนเพลงซ้ำ
    this.volume = 100;
    this.connection = null;
    this.streamHandle = null;
    this.resource = null;
    this.seekOffset = 0;
    this.idleTimer = null;
    this.destroyed = false;
    this.forceSkip = false;

    this.audioPlayer = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => this.#onIdle());
    this.audioPlayer.on('error', (err) => {
      console.error(`เล่นเพลงผิดพลาด (${this.current?.title}):`, err.message);
    });
  }

  connect(voiceChannel) {
    const alive = this.connection
      && this.connection.state.status !== VoiceConnectionStatus.Destroyed
      && this.connection.joinConfig.channelId === voiceChannel.id;
    if (alive) return;

    if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      this.connection.destroy();
    }
    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });
    this.connection.subscribe(this.audioPlayer);

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      // โดนเตะ/ย้ายห้อง — รอ reconnect แป๊บนึง ถ้าไม่กลับมาให้เก็บกวาด
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        destroyPlayer(this.guildId);
      }
    });
  }

  enqueue(tracks, requestedBy, { next = false } = {}) {
    for (const t of tracks) t.requestedBy = requestedBy;
    if (next) this.queue.unshift(...tracks);
    else this.queue.push(...tracks);
    this.#clearIdleTimer();
    if (!this.current) {
      this.#startTrack(this.queue.shift());
    }
  }

  skip() {
    const skipped = this.current;
    this.forceSkip = true; // ข้ามครั้งเดียวโดยไม่สน loop track
    this.audioPlayer.stop(true);
    return skipped;
  }

  pause() {
    return this.audioPlayer.pause();
  }

  resume() {
    return this.audioPlayer.unpause();
  }

  shuffle() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
  }

  remove(position) {
    return this.queue.splice(position - 1, 1)[0] || null;
  }

  setVolume(percent) {
    this.volume = percent;
    if (this.current) {
      // เริ่ม stream ใหม่จากตำแหน่งเดิมเพื่อให้เสียงเปลี่ยนทันที
      this.#startTrack(this.current, this.elapsedSeconds, false);
    }
  }

  get elapsedSeconds() {
    return this.seekOffset + Math.floor((this.resource?.playbackDuration || 0) / 1000);
  }

  get isPaused() {
    return this.audioPlayer.state.status === AudioPlayerStatus.Paused;
  }

  destroy() {
    this.destroyed = true;
    this.#clearIdleTimer();
    this.queue = [];
    this.current = null;
    this.#killStream();
    this.audioPlayer.stop(true);
    if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      this.connection.destroy();
    }
    this.connection = null;
  }

  #onIdle() {
    if (this.destroyed) return;
    this.#killStream();
    const finished = this.current;
    this.current = null;

    let next = null;
    if (finished && this.loopMode === 'track' && !this.forceSkip) {
      next = finished;
    } else {
      if (finished && this.loopMode === 'queue') this.queue.push(finished);
      next = this.queue.shift() || null;
    }
    this.forceSkip = false;

    if (next) this.#startTrack(next);
    else if (this.autoplay && finished) this.#autoplayNext(finished);
    else this.#startIdleTimer();
  }

  // คิวหมด — หาเพลงที่เกี่ยวข้องกับเพลงที่เพิ่งจบมาเล่นต่อ
  async #autoplayNext(finished) {
    this.#startIdleTimer(); // กันค้าง: ถ้าหาไม่เจอให้ timeout เดิมพาออกจากห้อง
    try {
      const track = await getRelatedTrack(finished.url, this.history);
      // ระหว่างรอ yt-dlp อาจมีคนสั่ง /play หรือ /stop ไปแล้ว
      if (this.destroyed || this.current || this.queue.length || !track) return;
      track.requestedBy = 'เล่นต่ออัตโนมัติ';
      this.#startTrack(track);
    } catch (err) {
      console.error('autoplay หาเพลงต่อไม่สำเร็จ:', err.message);
    }
  }

  #startTrack(track, seek = 0, announce = true) {
    this.#clearIdleTimer();
    this.#killStream();
    try {
      this.streamHandle = createTrackStream(track.url, { seek, volume: this.volume });
      this.resource = createAudioResource(this.streamHandle.stream, {
        inputType: StreamType.OggOpus,
      });
      this.seekOffset = seek;
      this.current = track;
      const id = videoIdFromUrl(track.url);
      if (id && this.history[this.history.length - 1] !== id) {
        this.history.push(id);
        if (this.history.length > 20) this.history.shift();
      }
      this.audioPlayer.play(this.resource);
      if (announce) this.#announce(track);
    } catch (err) {
      console.error(`เริ่มเพลงไม่สำเร็จ (${track.title}):`, err.message);
      this.#onIdle();
    }
  }

  #announce(track) {
    if (!this.textChannel) return;
    const embed = new EmbedBuilder()
      .setColor(0xe91e63)
      .setDescription(`🎵 กำลังเล่น: **[${track.title}](${track.url})** \`[${fmtDuration(track.duration)}]\`\nขอโดย ${track.requestedBy}`);
    this.textChannel.send({ embeds: [embed] }).catch(() => {});
  }

  #killStream() {
    this.streamHandle?.kill();
    this.streamHandle = null;
    this.resource = null;
    this.seekOffset = 0;
  }

  #startIdleTimer() {
    this.#clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.textChannel?.send('ไม่มีเพลงในคิวสักพักแล้ว ขอตัวออกจากห้องก่อนนะคะ').catch(() => {});
      destroyPlayer(this.guildId);
    }, IDLE_TIMEOUT_MS);
  }

  #clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
