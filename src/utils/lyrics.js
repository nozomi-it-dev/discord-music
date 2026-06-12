// ค้นเนื้อเพลงจาก LRCLIB (lrclib.net) — ฟรี ไม่ต้องใช้ API key

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

// คืน { title, artist, lyrics } หรือ null ถ้าไม่เจอ
// duration (วินาที) ถ้ามี ใช้เลือกผลที่ความยาวใกล้เคียงเพลงที่เล่นที่สุด
export async function searchLyrics(query, duration = 0) {
  const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'manora-discord-bot/0.1.0 (https://github.com/nozomi-it-dev/discord-music)' },
  });
  if (!res.ok) throw new Error(`ค้นเนื้อเพลงไม่สำเร็จ (lrclib ตอบ ${res.status})`);

  const results = (await res.json()).filter((r) => r.plainLyrics);
  if (!results.length) return null;

  const best = duration
    ? results.reduce((a, b) =>
        Math.abs(b.duration - duration) < Math.abs(a.duration - duration) ? b : a
      )
    : results[0];

  return { title: best.trackName, artist: best.artistName, lyrics: best.plainLyrics.trim() };
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
