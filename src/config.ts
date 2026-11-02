import "dotenv/config";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));

const defaultChatFile = existsSync(
  join(ROOT_DIR, "..", "WhatsApp Chat with Status links .txt"),
)
  ? join(ROOT_DIR, "..", "WhatsApp Chat with Status links .txt")
  : join(ROOT_DIR, "..", "chat", "chat.txt");

export const config = {
  CHAT_FILE: process.env.CHAT_FILE ?? defaultChatFile,
  REELS_OUTPUT_DIR: join(ROOT_DIR, "..", "reels"),
  OUTPUT_FORMAT: "%(uploader)s - %(title)s - %(id)s.%(ext)s",
  VIDEO_FORMAT: "mp4",
  LOG_LEVEL: "info",
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "",
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ?? "",
  RAPIDAPI_HOST:
    process.env.RAPIDAPI_HOST ??
    "instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com",
};
