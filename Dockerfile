# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 ffmpeg

COPY package*.json ./

RUN npm ci

COPY . ./

RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 ffmpeg

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/telegramBot.js"]
