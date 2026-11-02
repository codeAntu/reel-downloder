import { createReadStream, unlinkSync } from "fs";
import http from "http";
import { basename } from "path";
import { Telegraf } from "telegraf";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { isValidSocialLink } from "./modules/chatParser.js";
import { downloadReelForBot } from "./modules/downloader.js";

if (!config.TELEGRAM_BOT_TOKEN)
  throw new Error("TELEGRAM_BOT_TOKEN is not set in .env");

const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

// Lightweight HTTP server for Render / cloud health checks
const PORT = process.env.PORT || 3000;
const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running!");
});

server.listen(PORT, () => {
  logger.info(`Health check server listening on port ${PORT}`);
});

bot.on("text", async (ctx) => {
  const urlMatch = ctx.message.text.trim().match(/(https:\/\/[^\s]+)/);
  if (!urlMatch) return;

  const url = urlMatch[1].replace(/[\s,)]*$/, "");
  if (!isValidSocialLink(url)) {
    await ctx.reply("Only Instagram and Facebook reel links are supported.");
    return;
  }

  const statusMsg = await ctx.reply("Downloading...");

  const filePath = await downloadReelForBot(url);

  if (!filePath) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      undefined,
      "Failed to download the reel. Make sure the link is valid and public.",
    );
    return;
  }

  try {
    // Send as playable video first, fallback to document if format issues
    try {
      await ctx.replyWithVideo(
        { source: createReadStream(filePath) },
        { caption: url, supports_streaming: true },
      );
    } catch {
      await ctx.replyWithDocument(
        { source: createReadStream(filePath), filename: basename(filePath) },
        { caption: url },
      );
    }

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      undefined,
      "Downloaded and sent back to you!",
    );
  } catch (error) {
    logger.error("Failed to send video:", error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      undefined,
      "Downloaded but failed to send the video. Check bot permissions or chat access.",
    );
  } finally {
    try {
      unlinkSync(filePath);
    } catch {}
  }
});

bot.launch().then(() => logger.info("Bot started. Send a reel link to begin."));

process.once("SIGINT", () => {
  bot.stop("SIGINT");
  server.close();
});
process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  server.close();
});
