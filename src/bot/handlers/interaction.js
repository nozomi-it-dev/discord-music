import { MessageFlags } from 'discord.js';
import { getPlayer, peekPlayer, destroyPlayer } from '../../player/index.js';
import { resolveTracks } from '../../player/ytdlp.js';
import { fmtDuration } from '../../utils/format.js';
import { cleanTitle, cleanChannel, searchLyrics, findLyricsForTrack, chunkLyrics } from '../../utils/lyrics.js';
import { getTrackMeta } from '../../player/ytdlp.js';

const LOOP_LABEL = { off: 'ปิด', track: 'วนเพลงเดียว', queue: 'วนทั้งคิว' };

export async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const handler = handlers[interaction.commandName];
  if (!handler) return;

  try {
    await handler(interaction);
  } catch (err) {
    console.error(`คำสั่ง /${interaction.commandName} ผิดพลาด:`, err);
    const msg = `มีปัญหาค่ะ: ${err.message}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
}

// คืน player ที่กำลังเล่นอยู่ หรือ reply error แล้วคืน null
async function requirePlaying(interaction) {
  const player = peekPlayer(interaction.guildId);
  if (!player?.current) {
    await interaction.reply({ content: 'ตอนนี้ไม่มีเพลงกำลังเล่นค่ะ', flags: MessageFlags.Ephemeral });
    return null;
  }
  return player;
}

async function handlePlay(interaction, { next = false } = {}) {
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: 'เข้าห้องเสียงก่อนนะคะ แล้วค่อยสั่งเล่นเพลง', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply();
  const query = interaction.options.getString('query');
  const { playlist, tracks } = await resolveTracks(query);

  const player = getPlayer(interaction.guildId, interaction.channel);
  player.connect(voiceChannel);
  player.enqueue(tracks, interaction.member.displayName, { next });

  const where = next ? 'ไว้หัวคิว เล่นต่อจากเพลงนี้เลย' : 'เข้าคิวแล้ว';
  if (playlist) {
    await interaction.editReply(`✅ เพิ่ม ${tracks.length} เพลงจาก **${playlist}** ${where}ค่ะ`);
  } else {
    const t = tracks[0];
    await interaction.editReply(`✅ เพิ่ม${next ? 'ไว้หัวคิว' : 'เข้าคิว'}: **${t.title}** \`[${fmtDuration(t.duration)}]\``);
  }
}

const handlers = {
  play: handlePlay,

  async playnext(interaction) {
    return handlePlay(interaction, { next: true });
  },

  async autoplay(interaction) {
    const mode = interaction.options.getString('mode');
    const player = getPlayer(interaction.guildId, interaction.channel);
    player.autoplay = mode === 'on';
    await interaction.reply(
      mode === 'on'
        ? '🎶 เปิด autoplay แล้วค่ะ คิวหมดเมื่อไหร่จะหาเพลงที่เกี่ยวข้องมาเล่นต่อให้เอง'
        : '🛑 ปิด autoplay แล้วค่ะ คิวหมดแล้วจะหยุดเล่นตามปกติ'
    );
  },

  async skip(interaction) {
    const player = await requirePlaying(interaction);
    if (!player) return;
    const skipped = player.skip();
    await interaction.reply(`⏭️ ข้าม: **${skipped.title}**`);
  },

  async stop(interaction) {
    const player = peekPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: 'ตอนนี้ไม่ได้เล่นเพลงอยู่ค่ะ', flags: MessageFlags.Ephemeral });
    }
    destroyPlayer(interaction.guildId);
    await interaction.reply('⏹️ หยุดเล่นและล้างคิวแล้วค่ะ');
  },

  async pause(interaction) {
    const player = await requirePlaying(interaction);
    if (!player) return;
    player.pause();
    await interaction.reply('⏸️ พักเพลงไว้ค่ะ ใช้ /resume เพื่อเล่นต่อ');
  },

  async resume(interaction) {
    const player = await requirePlaying(interaction);
    if (!player) return;
    player.resume();
    await interaction.reply('▶️ เล่นต่อค่ะ');
  },

  async queue(interaction) {
    const player = peekPlayer(interaction.guildId);
    if (!player?.current) {
      return interaction.reply({ content: 'คิวว่างอยู่ค่ะ ใช้ /play เพิ่มเพลงได้เลย', flags: MessageFlags.Ephemeral });
    }

    const lines = [
      `🎵 กำลังเล่น: **${player.current.title}** \`[${fmtDuration(player.elapsedSeconds)}/${fmtDuration(player.current.duration)}]\``,
    ];
    if (player.loopMode !== 'off') lines.push(`🔁 โหมดวน: ${LOOP_LABEL[player.loopMode]}`);
    if (player.queue.length) {
      lines.push('', '**คิวถัดไป:**');
      player.queue.slice(0, 10).forEach((t, i) => {
        lines.push(`${i + 1}. ${t.title} \`[${fmtDuration(t.duration)}]\` — ${t.requestedBy}`);
      });
      if (player.queue.length > 10) lines.push(`...และอีก ${player.queue.length - 10} เพลง`);
    } else {
      lines.push('', 'ไม่มีเพลงต่อจากนี้ในคิวค่ะ');
    }
    await interaction.reply(lines.join('\n').slice(0, 2000));
  },

  async nowplaying(interaction) {
    const player = await requirePlaying(interaction);
    if (!player) return;
    const t = player.current;
    const status = player.isPaused ? '⏸️ พักอยู่' : '🎵 กำลังเล่น';
    await interaction.reply(
      `${status}: **[${t.title}](${t.url})** \`[${fmtDuration(player.elapsedSeconds)}/${fmtDuration(t.duration)}]\` — ขอโดย ${t.requestedBy}`
    );
  },

  async shuffle(interaction) {
    const player = peekPlayer(interaction.guildId);
    if (!player || player.queue.length < 2) {
      return interaction.reply({ content: 'มีเพลงในคิวไม่พอจะสลับค่ะ', flags: MessageFlags.Ephemeral });
    }
    player.shuffle();
    await interaction.reply(`🔀 สลับคิว ${player.queue.length} เพลงแล้วค่ะ`);
  },

  async loop(interaction) {
    const player = await requirePlaying(interaction);
    if (!player) return;
    const mode = interaction.options.getString('mode');
    player.loopMode = mode;
    await interaction.reply(`🔁 ตั้งโหมดวนเป็น: **${LOOP_LABEL[mode]}**`);
  },

  async remove(interaction) {
    const player = peekPlayer(interaction.guildId);
    const position = interaction.options.getInteger('position');
    if (!player || position > player.queue.length) {
      return interaction.reply({ content: 'ไม่มีเพลงในตำแหน่งนั้นค่ะ ดูคิวด้วย /queue ก่อนนะคะ', flags: MessageFlags.Ephemeral });
    }
    const removed = player.remove(position);
    await interaction.reply(`🗑️ ลบออกจากคิว: **${removed.title}**`);
  },

  async lyrics(interaction) {
    const query = interaction.options.getString('query');
    const player = peekPlayer(interaction.guildId);

    if (!query && !player?.current) {
      return interaction.reply({
        content: 'ตอนนี้ไม่มีเพลงกำลังเล่นค่ะ ใส่ชื่อเพลงใน query แทนได้นะคะ',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();
    let found;
    let label;
    if (query) {
      label = query;
      found = await searchLyrics(query);
    } else {
      const t = player.current;
      label = cleanTitle(t.title);
      // ดึงชื่อศิลปิน/channel จากวิดีโอจริงมาช่วยค้น — ชื่อคลิปอย่างเดียวมักกำกวม
      const meta = await getTrackMeta(t.url).catch(() => null);
      const queries = [
        meta?.artist && meta?.track ? `${meta.track} ${meta.artist}` : null,
        meta?.channel ? `${label} ${cleanChannel(meta.channel)}` : null,
        label,
      ];
      found = await findLyricsForTrack(queries, meta?.duration || t.duration);
    }
    if (!found) {
      return interaction.editReply(
        `หาเนื้อเพลงที่ตรงกับ "${label}" ไม่เจอค่ะ ลองพิมพ์ชื่อเพลงกับศิลปินใน query ดูนะคะ`
      );
    }

    const chunks = chunkLyrics(found.lyrics);
    await interaction.editReply(`📜 **${found.title}** — ${found.artist}\n\n${chunks[0]}`);
    for (const chunk of chunks.slice(1)) {
      await interaction.followUp(chunk);
    }
  },

  async volume(interaction) {
    const player = await requirePlaying(interaction);
    if (!player) return;
    const percent = interaction.options.getInteger('percent');
    player.setVolume(percent);
    await interaction.reply(`🔊 ปรับเสียงเป็น ${percent}% แล้วค่ะ`);
  },
};
