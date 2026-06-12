import { SlashCommandBuilder } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('เล่นเพลงจากลิงค์ YouTube หรือค้นหาด้วยชื่อเพลง')
    .addStringOption((opt) =>
      opt.setName('query')
        .setDescription('ลิงค์ YouTube / ลิงค์ playlist / ชื่อเพลง')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('playnext')
    .setDescription('เพิ่มเพลงไว้หัวคิว ให้เล่นต่อจากเพลงปัจจุบันทันที')
    .addStringOption((opt) =>
      opt.setName('query')
        .setDescription('ลิงค์ YouTube / ลิงค์ playlist / ชื่อเพลง')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('เปิด/ปิดการหาเพลงที่เกี่ยวข้องมาเล่นต่อเองเมื่อคิวหมด')
    .addStringOption((opt) =>
      opt.setName('mode')
        .setDescription('เปิดหรือปิด')
        .setRequired(true)
        .addChoices(
          { name: 'เปิด', value: 'on' },
          { name: 'ปิด', value: 'off' },
        )
    ),
  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('ข้ามเพลงปัจจุบัน'),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('หยุดเล่น ล้างคิว และออกจากห้อง'),
  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('พักเพลงชั่วคราว'),
  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('เล่นเพลงต่อจากที่พักไว้'),
  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('ดูคิวเพลง'),
  new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('ดูเพลงที่กำลังเล่นอยู่'),
  new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('สลับลำดับเพลงในคิว'),
  new SlashCommandBuilder()
    .setName('loop')
    .setDescription('ตั้งโหมดเล่นวน')
    .addStringOption((opt) =>
      opt.setName('mode')
        .setDescription('โหมดเล่นวน')
        .setRequired(true)
        .addChoices(
          { name: 'ปิด', value: 'off' },
          { name: 'วนเพลงเดียว', value: 'track' },
          { name: 'วนทั้งคิว', value: 'queue' },
        )
    ),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('ลบเพลงออกจากคิว')
    .addIntegerOption((opt) =>
      opt.setName('position')
        .setDescription('ลำดับเพลงในคิว (ดูจาก /queue)')
        .setRequired(true)
        .setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('ดูเนื้อเพลงของเพลงที่กำลังเล่น หรือค้นหาด้วยชื่อเพลง')
    .addStringOption((opt) =>
      opt.setName('query')
        .setDescription('ชื่อเพลง (ไม่ใส่ = ใช้เพลงที่กำลังเล่นอยู่)')
    ),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('ปรับระดับเสียง (0-200, ปกติ 100)')
    .addIntegerOption((opt) =>
      opt.setName('percent')
        .setDescription('ระดับเสียงเป็นเปอร์เซ็นต์')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(200)
    ),
];
