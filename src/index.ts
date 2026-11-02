import { existsSync } from "fs";
import { resolve } from "path";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { extractLinksFromChat } from "./modules/chatParser.js";
import { downloadReels } from "./modules/downloader.js";

async function main() {
  try {
    const targetFile = process.argv[2]
      ? resolve(process.argv[2])
      : config.CHAT_FILE;

    logger.info(`Extracting links from: ${targetFile}`);
    if (!existsSync(targetFile)) {
      logger.error(`File does not exist: ${targetFile}`);
      return;
    }

    const links = extractLinksFromChat(targetFile);
    logger.info(`Found ${links.length} unique links to download`);

    if (links.length === 0) {
      logger.warn("No links found in chat file");
      return;
    }
    logger.info("Starting downloads (5 parallel)...\n");
    const stats = await downloadReels(
      links,
      (current: number, total: number, url: string, status?: string) => {
        const statusLabel =
          status === "CACHED" ? "📦 CACHED" : "⬇️ DOWNLOADING";
        logger.info(`[${current}/${total}] ${statusLabel}: ${url}`);
      },
      5, // concurrency
    );

    logger.info("\n=== Download Summary ===");
    logger.info(`Total URLs: ${stats.total}`);
    logger.info(`✓ Downloaded: ${stats.success}`);
    logger.info(`📦 Cached: ${stats.skipped}`);
    logger.info(`✗ Failed: ${stats.failed}`);
    const completed = stats.success + stats.skipped;
    logger.info(
      `Success rate: ${((completed / stats.total) * 100).toFixed(1)}%`,
    );
  } catch (error) {
    logger.error("Fatal error:", error);
    process.exit(1);
  }
}

main().catch(logger.error);
