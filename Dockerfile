FROM node:22-alpine

RUN apk add --no-cache ffmpeg python3 \
 && wget -qO /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

# อัปเดต yt-dlp ทุกครั้งที่ start — restart container = ได้ yt-dlp ล่าสุดโดยไม่ต้อง rebuild
CMD ["sh", "-c", "yt-dlp -U || true; exec node src/index.js"]
