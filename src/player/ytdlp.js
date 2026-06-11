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
