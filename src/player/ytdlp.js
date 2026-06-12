import { spawn } from 'node:child_process';

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';

function isUrl(input) {
  try {
    const u = new URL(input);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function runJson(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(err.trim().split('\n').pop() || `yt-dlp exited ${code}`));
      }
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(new Error('yt-dlp คืนข้อมูลที่อ่านไม่ได้'));
      }
    });
  });
}

export function videoIdFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}

// หาเพลงที่เกี่ยวข้องจาก YouTube Mix (list=RD<id>) ของเพลงที่ให้มา
// excludeIds = id ที่เล่นไปแล้ว กันวนซ้ำ — คืน track หรือ null ถ้าไม่เจอ
export async function getRelatedTrack(url, excludeIds = []) {
  const id = videoIdFromUrl(url);
  if (!id) return null;

  const json = await runJson([
    '-J', '--flat-playlist', '--no-warnings', '--playlist-end', '15',
    `https://www.youtube.com/watch?v=${id}&list=RD${id}`,
  ]);
  const exclude = new Set([id, ...excludeIds]);
  const pick = (json.entries || []).filter(Boolean).find((e) => e.id && !exclude.has(e.id));
  if (!pick) return null;

  return {
    url: pick.url || `https://www.youtube.com/watch?v=${pick.id}`,
    title: pick.title || 'ไม่ทราบชื่อเพลง',
    duration: pick.duration || 0,
  };
}

// ดึง metadata เต็มของวิดีโอเดียว (ช้ากว่า flat แต่ได้ชื่อศิลปิน/channel) — ใช้ตอนค้นเนื้อเพลง
export async function getTrackMeta(url) {
  const json = await runJson(['-J', '--no-playlist', '--no-warnings', url]);
  return {
    track: json.track || null,
    artist: json.artist || json.creator || null,
    channel: json.channel || json.uploader || null,
    title: json.title || '',
    duration: json.duration || 0,
  };
}

// คืน array ของ track: { url, title, duration }
// query เป็นได้ทั้งลิงค์เพลงเดียว, ลิงค์ playlist, หรือชื่อเพลง (ค้น YouTube เอาผลแรก)
export async function resolveTracks(query) {
  const target = isUrl(query) ? query : `ytsearch1:${query}`;
  const json = await runJson(['-J', '--flat-playlist', '--no-warnings', target]);

  if (json._type === 'playlist') {
    const entries = (json.entries || []).filter(Boolean);
    if (!entries.length) throw new Error('ไม่พบเพลงที่ค้นหา');
    return {
      playlist: entries.length > 1 ? json.title || 'playlist' : null,
      tracks: entries.map((e) => ({
        url: e.url || `https://www.youtube.com/watch?v=${e.id}`,
        title: e.title || 'ไม่ทราบชื่อเพลง',
        duration: e.duration || 0,
      })),
    };
  }

  return {
    playlist: null,
    tracks: [{
      url: json.webpage_url || query,
      title: json.title || 'ไม่ทราบชื่อเพลง',
      duration: json.duration || 0,
    }],
  };
}
