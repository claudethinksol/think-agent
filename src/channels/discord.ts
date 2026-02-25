import { logger } from "../index.js";
import { getOrCreateSession, saveMessage, getMessageHistory } from "../db.js";
import { askAgent } from "../agent.js";

/**
 * Discord channel adapter using discord.js.
 *
 * Setup instructions:
 * 1. Create a Discord application at https://discord.com/developers/applications
 * 2. Add a Bot to your application — copy the bot token
 * 3. Enable "Message Content Intent" under Privileged Gateway Intents
 * 4. Add DISCORD_TOKEN to your .env file
 * 5. Invite the bot to your server using OAuth2 URL generator (scopes: bot, permissions: Send Messages, Read Messages)
 * 6. Install: npm install discord.js
 * 7. Start the agent
 *
 * The agent responds to all messages in channels it has access to.
 */

export async function startDiscord(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error("DISCORD_TOKEN not set in .env");
  }

  logger.info("Starting Discord channel...");

  try {
    const { Client, GatewayIntentBits } = await import("discord.js" as string);

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    client.on("ready", () => {
      logger.info(`Discord bot logged in as ${client.user?.tag}`);
    });

    client.on("messageCreate", async (message: { author: { bot: boolean }; channelId: string; content: string; reply: (opts: { content: string }) => Promise<void> }) => {
      if (message.author.bot) return;
      if (!message.content) return;

      const groupId = message.channelId;
      const sessionId = getOrCreateSession(groupId, "discord");
      saveMessage(sessionId, "user", message.content);

      const history = getMessageHistory(sessionId);
      const reply = await askAgent(history);

      saveMessage(sessionId, "assistant", reply);
      await message.reply({ content: reply });
    });

    client.on("error", (err: Error) => {
      logger.error({ err }, "Discord client error");
    });

    await client.login(token);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Cannot find module")) {
      logger.error("discord.js not installed. Run: npm install discord.js");
    } else {
      logger.error({ err }, "Discord channel failed to start");
    }
    throw err;
  }
}
