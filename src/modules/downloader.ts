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

interface DownloadStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

const CACHE_FILE = join(config.REELS_OUTPUT_DIR, ".downloaded.json");

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

async function downloadSingleReel(url: string): Promise<boolean> {
  try {
    await youtubedl(url, {
      output: `${config.REELS_OUTPUT_DIR}/${config.OUTPUT_FORMAT}`,
      format: "b[ext=mp4]/best",
      mergeOutputFormat: "mp4",
    });
    saveDownloadedUrl(url);
    return true;
  } catch {
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
  concurrency: number = 20,
): Promise<DownloadStats> {
  if (!existsSync(config.REELS_OUTPUT_DIR)) {
    mkdirSync(config.REELS_OUTPUT_DIR, { recursive: true });
  }

  return downloadWithConcurrency(links, concurrency, onProgress);
}

export async function downloadReelForBot(url: string): Promise<string | null> {
  if (!existsSync(config.REELS_OUTPUT_DIR)) {
    mkdirSync(config.REELS_OUTPUT_DIR, { recursive: true });
  }

  const id = randomUUID();
  const outputTemplate = join(config.REELS_OUTPUT_DIR, `${id}.%(ext)s`);

  try {
    await youtubedl(url, {
      output: outputTemplate,
      format: "b[ext=mp4]/best",
      mergeOutputFormat: "mp4",
    });

    const expectedPath = join(config.REELS_OUTPUT_DIR, `${id}.mp4`);
    if (existsSync(expectedPath)) return expectedPath;

    const match = readdirSync(config.REELS_OUTPUT_DIR).find((f) =>
      f.startsWith(id),
    );
    return match ? join(config.REELS_OUTPUT_DIR, match) : null;
  } catch {
    return null;
  }
}
