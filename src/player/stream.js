import { spawn } from 'node:child_process';

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

// ดึง audio จาก YouTube ผ่าน yt-dlp แล้วแปลงเป็น Ogg/Opus ด้วย ffmpeg
// คืน { stream, kill } — stream คือ stdout ของ ffmpeg, kill ใช้เก็บกวาด process ทั้งคู่
export function createTrackStream(url, { seek = 0, volume = 100 } = {}) {
  const ytdlp = spawn(YTDLP, [
    '-f', 'bestaudio[acodec=opus]/bestaudio/best',
    '--no-playlist',
    '--no-warnings',
    '-q',
    '-o', '-',
    url,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const ffArgs = ['-loglevel', 'error', '-i', 'pipe:0'];
  if (seek > 0) ffArgs.push('-ss', String(seek));
  ffArgs.push(
    '-vn',
    '-af', `volume=${(volume / 100).toFixed(2)}`,
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-f', 'opus',
    'pipe:1',
  );
  const ffmpeg = spawn(FFMPEG, ffArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

  ytdlp.stdout.pipe(ffmpeg.stdin);

  // กัน EPIPE ตอน process ฝั่งใดฝั่งหนึ่งถูก kill ก่อน
  ytdlp.stdout.on('error', () => {});
  ffmpeg.stdin.on('error', () => {});

  let errLog = '';
  ytdlp.stderr.on('data', (d) => (errLog += d));
  ffmpeg.stderr.on('data', (d) => (errLog += d));

  let killed = false;
  const onClose = (name) => (code) => {
    if (!killed && code !== 0 && errLog.trim()) {
      console.error(`${name} (${url}):`, errLog.trim().split('\n').pop());
    }
  };
  ytdlp.on('close', onClose('yt-dlp'));
  ffmpeg.on('close', onClose('ffmpeg'));

  return {
    stream: ffmpeg.stdout,
    kill() {
      killed = true;
      ytdlp.kill('SIGKILL');
      ffmpeg.kill('SIGKILL');
    },
  };
}
