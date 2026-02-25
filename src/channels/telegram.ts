import { logger } from "../index.js";
import { getOrCreateSession, saveMessage, getMessageHistory } from "../db.js";
import { askAgent } from "../agent.js";

/**
 * Telegram channel adapter using node-telegram-bot-api.
 *
 * Setup instructions:
 * 1. Create a bot via @BotFather on Telegram — get your bot token
 * 2. Add TELEGRAM_BOT_TOKEN to your .env file
 * 3. Add the bot to your Telegram group(s)
 * 4. Install: npm install node-telegram-bot-api @types/node-telegram-bot-api
 * 5. Start the agent — it will begin receiving messages
 *
 * The agent responds to all messages in groups where it has been added.
 */

export async function startTelegram(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN not set in .env");
  }

  logger.info("Starting Telegram channel...");

  try {
    const { default: TelegramBot } = await import("node-telegram-bot-api" as string);

    const bot = new TelegramBot(token, { polling: true });

    bot.on("message", async (msg: { chat: { id: number }; text?: string; from?: { username?: string } }) => {
      const chatId = msg.chat.id;
      const text = msg.text;
      if (!text) return;

      const groupId = String(chatId);
      const sessionId = getOrCreateSession(groupId, "telegram");
      saveMessage(sessionId, "user", text);

      const history = getMessageHistory(sessionId);
      const reply = await askAgent(history);

      saveMessage(sessionId, "assistant", reply);
      await bot.sendMessage(chatId, reply);
    });

    bot.on("polling_error", (err: Error) => {
      logger.error({ err }, "Telegram polling error");
    });

    logger.info("Telegram bot is listening for messages");
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Cannot find module")) {
      logger.error("node-telegram-bot-api not installed. Run: npm install node-telegram-bot-api");
    } else {
      logger.error({ err }, "Telegram channel failed to start");
    }
    throw err;
  }
}
