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

// Deployment setup: Auto-detect Webhooks for Render/Cloud vs. Polling for Local
const PORT = Number(process.env.PORT) || 3000;
const DOMAIN = process.env.RENDER_EXTERNAL_URL || process.env.WEBHOOK_DOMAIN;

if (DOMAIN) {
  // Render automatically provides RENDER_EXTERNAL_URL (e.g. https://my-app.onrender.com)
  const webhookUrl = `${DOMAIN.replace(/\/+$/, "")}/webhook`;
  const webhookHandler = bot.webhookCallback("/webhook");

  const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Bot is running!");
      return;
    }
    webhookHandler(req, res);
  });

  server.listen(PORT, async () => {
    logger.info(`Webhook server listening on port ${PORT}`);
    try {
      await bot.telegram.setWebhook(webhookUrl);
      logger.info(`Telegram webhook configured at: ${webhookUrl}`);
    } catch (err) {
      logger.error("Failed to register Telegram webhook:", err);
    }
  });

  process.once("SIGINT", () => server.close());
  process.once("SIGTERM", () => server.close());
} else {
  // Local development: Long Polling
  bot.launch().then(() => {
    logger.info("Bot started in long-polling mode (local development).");
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
