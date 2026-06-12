// ค้นเนื้อเพลงจาก LRCLIB (lrclib.net) — ฟรี ไม่ต้องใช้ API key

// ชื่อเพลงเดียวกันมีหลายศิลปิน — ยอมรับเฉพาะผลที่ความยาวต่างจากเพลงที่เล่นไม่เกินนี้
const DURATION_TOLERANCE = 10;

// ตัดคำขยะที่มักติดมากับชื่อคลิป YouTube ให้เหลือชื่อเพลงจริงไว้ค้นหา
export function cleanTitle(title) {
  return title
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\(([^)]*)\)/g, (m, inner) =>
      /official|mv|m\/v|lyric|audio|video|live|cover|4k|hd|เนื้อเพลง|เพลงใหม่/i.test(inner) ? ' ' : m
    )
    .replace(/official\s*(music\s*video|video|mv|audio)/gi, ' ')
    .replace(/\s*\|.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ตัดคำห้อยท้ายชื่อ channel ที่ไม่ใช่ชื่อศิลปิน เช่น "Artist - Topic", "ArtistVEVO"
export function cleanChannel(name = '') {
  return name
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\s*official\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function queryLrclib(q) {
  const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
    headers: { 'User-Agent': 'manora-discord-bot/0.1.0 (https://github.com/nozomi-it-dev/discord-music)' },
  });
  if (!res.ok) throw new Error(`ค้นเนื้อเพลงไม่สำเร็จ (lrclib ตอบ ${res.status})`);
  return (await res.json()).filter((r) => r.plainLyrics);
}

function toResult(r) {
  return { title: r.trackName, artist: r.artistName, lyrics: r.plainLyrics.trim() };
}

// ค้นด้วยข้อความเดียว (ผู้ใช้พิมพ์เอง) — ไม่รู้ความยาวเพลง เลยเอาผลแรกที่มีเนื้อ
export async function searchLyrics(query) {
  const results = await queryLrclib(query);
  return results.length ? toResult(results[0]) : null;
}

// ค้นสำหรับเพลงที่กำลังเล่น — ไล่ลองทีละ query (เรียงจากแม่นสุด)
// และยอมรับเฉพาะผลที่ความยาวใกล้เพลงจริง กันหยิบเพลงผิดศิลปินมาแสดง
export async function findLyricsForTrack(queries, duration) {
  const tried = new Set();
  for (const q of queries) {
    if (!q || tried.has(q.toLowerCase())) continue;
    tried.add(q.toLowerCase());

    const results = await queryLrclib(q);
    const candidates = duration
      ? results.filter((r) => Math.abs(r.duration - duration) <= DURATION_TOLERANCE)
      : results;
    if (candidates.length) {
      const best = duration
        ? candidates.reduce((a, b) =>
            Math.abs(b.duration - duration) < Math.abs(a.duration - duration) ? b : a
          )
        : candidates[0];
      return toResult(best);
    }
  }
  return null;
}

// แบ่งเนื้อเพลงเป็นท่อนยาวไม่เกิน size ตัวอักษร โดยตัดตามบรรทัด
export function chunkLyrics(text, size = 1900) {
  const chunks = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if (cur && cur.length + line.length + 1 > size) {
      chunks.push(cur);
      cur = line;
    } else {
      cur = cur ? `${cur}\n${line}` : line;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}
