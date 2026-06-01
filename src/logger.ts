import { config } from "./config.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private currentLevel = LOG_LEVELS[config.LOG_LEVEL as LogLevel] || 1;

  debug(message: string, ...args: unknown[]) {
    if (this.currentLevel <= LOG_LEVELS.debug) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]) {
    if (this.currentLevel <= LOG_LEVELS.info) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]) {
    if (this.currentLevel <= LOG_LEVELS.warn) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]) {
    if (this.currentLevel <= LOG_LEVELS.error) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();
