import { randomUUID } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import youtubedl from "yt-dlp-exec";
import { config } from "../config.js";
import { logger } from "../logger.js";

interface DownloadStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

const CACHE_FILE = join(config.REELS_OUTPUT_DIR, ".downloaded.json");

function getTodayOutputDir(): string {
  const dir = join(config.REELS_OUTPUT_DIR, "today");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getDownloadedUrls(): Set<string> {
  try {
    if (existsSync(CACHE_FILE)) {
      const data = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
      return new Set(data.urls || []);
    }
  } catch {
    return new Set();
  }
  return new Set();
}

function saveDownloadedUrl(url: string): void {
  try {
    const cache = existsSync(CACHE_FILE)
      ? JSON.parse(readFileSync(CACHE_FILE, "utf-8"))
      : { urls: [] };

    if (!cache.urls.includes(url)) {
      cache.urls.push(url);
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // Silently fail
  }
}

async function downloadViaRapidApi(
  url: string,
  outputPath: string,
): Promise<boolean> {
  if (!config.RAPIDAPI_KEY) return false;

  try {
    const res = await fetch(
      `https://${config.RAPIDAPI_HOST}/fetch?url=${encodeURIComponent(url)}`,
      {
        headers: {
          "x-rapidapi-key": config.RAPIDAPI_KEY,
          "x-rapidapi-host": config.RAPIDAPI_HOST,
        },
      },
    );

    if (!res.ok) {
      logger.warn(`RapidAPI HTTP status ${res.status} for ${url}`);
      return false;
    }

    const data: any = await res.json();
    if (!data || !data.download_url) {
      logger.warn(
        `RapidAPI: No download_url returned for ${url} (${data?.message || "Unknown error"})`,
      );
      return false;
    }

    const videoRes = await fetch(data.download_url);
    if (!videoRes.ok) {
      logger.warn(
        `Failed to fetch video stream from CDN: status ${videoRes.status}`,
      );
      return false;
    }

    const arrayBuffer = await videoRes.arrayBuffer();
    writeFileSync(outputPath, Buffer.from(arrayBuffer));
    return true;
  } catch (error: any) {
    logger.warn(`RapidAPI error for ${url}: ${error?.message || error}`);
    return false;
  }
}

async function downloadSingleReel(url: string): Promise<boolean> {
  const outputDir = getTodayOutputDir();

  // Extract reel ID from URL (e.g. /reel/DU_vKngitDn/)
  const idMatch = url.match(/\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
  const reelId = idMatch ? idMatch[1] : randomUUID();
  const targetFile = join(outputDir, `${reelId}.mp4`);

  // 1. Try RapidAPI first (handles copyright music, high speed, no IP bans)
  if (config.RAPIDAPI_KEY) {
    const success = await downloadViaRapidApi(url, targetFile);
    if (success) {
      saveDownloadedUrl(url);
      return true;
    }
  }

  // 2. Fallback to yt-dlp if RapidAPI fails or isn't configured
  try {
    const options: any = {
      output: `${outputDir}/${config.OUTPUT_FORMAT}`,
      format: "bestvideo+bestaudio/best",
      mergeOutputFormat: "mp4",
    };

    const cookiesPath = join(process.cwd(), "cookies.txt");
    if (existsSync(cookiesPath)) {
      options.cookies = cookiesPath;
    }

    await youtubedl(url, options);
    saveDownloadedUrl(url);
    return true;
  } catch (error: any) {
    logger.error(`yt-dlp failed to download ${url}: ${error?.message || error}`);
    return false;
  }
}

async function downloadWithConcurrency(
  links: string[],
  concurrency: number,
  onProgress?: (
    current: number,
    total: number,
    url: string,
    status: string,
  ) => void,
): Promise<DownloadStats> {
  const downloadedUrls = getDownloadedUrls();
  const stats: DownloadStats = {
    total: links.length,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  const toDownload = links.filter((url) => !downloadedUrls.has(url));
  const toSkip = links.filter((url) => downloadedUrls.has(url));

  stats.skipped = toSkip.length;

  let processedCount = 0;
  for (const url of toSkip) {
    processedCount++;
    onProgress?.(processedCount, stats.total, url, "CACHED");
  }

  const queue = [...toDownload];
  const running: Promise<void>[] = [];

  for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
    const processQueue = async () => {
      while (queue.length > 0) {
        const link = queue.shift();
        if (!link) break;

        processedCount++;
        onProgress?.(processedCount, stats.total, link, "DOWNLOADING");

        if (await downloadSingleReel(link)) {
          stats.success++;
        } else {
          stats.failed++;
        }
      }
    };

    running.push(processQueue());
  }

  await Promise.all(running);
  return stats;
}

export async function downloadReels(
  links: string[],
  onProgress?: (
    current: number,
    total: number,
    url: string,
    status?: string,
  ) => void,
  concurrency: number = 5,
): Promise<DownloadStats> {
  getTodayOutputDir();
  return downloadWithConcurrency(links, concurrency, onProgress);
}

export async function downloadReelForBot(url: string): Promise<string | null> {
  const outputDir = getTodayOutputDir();

  const id = randomUUID();
  const targetFile = join(outputDir, `${id}.mp4`);

  // 1. Try RapidAPI first
  if (config.RAPIDAPI_KEY) {
    const success = await downloadViaRapidApi(url, targetFile);
    if (success && existsSync(targetFile)) {
      return targetFile;
    }
  }

  // 2. Fallback to yt-dlp
  try {
    const outputTemplate = join(outputDir, `${id}.%(ext)s`);
    const options: any = {
      output: outputTemplate,
      format: "bestvideo+bestaudio/best",
      mergeOutputFormat: "mp4",
    };

    const cookiesPath = join(process.cwd(), "cookies.txt");
    if (existsSync(cookiesPath)) {
      options.cookies = cookiesPath;
    }

    await youtubedl(url, options);

    if (existsSync(targetFile)) return targetFile;

    const match = readdirSync(outputDir).find((f) => f.startsWith(id));
    return match ? join(outputDir, match) : null;
  } catch (error: any) {
    logger.error(`Bot download failed for ${url}: ${error?.message || error}`);
    return null;
  }
}
