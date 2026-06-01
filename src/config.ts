import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));

export const config = {
  CHAT_FILE: join(ROOT_DIR, "..", "chat", "chat.txt"),
  REELS_OUTPUT_DIR: join(ROOT_DIR, "..", "reels"),
  OUTPUT_FORMAT: "%(uploader)s - %(title)s - %(id)s.%(ext)s",
  VIDEO_FORMAT: "mp4",
  LOG_LEVEL: "info",
};
