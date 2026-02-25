import { logger } from "../index.js";
import { getOrCreateSession, saveMessage, getMessageHistory } from "../db.js";
import { askAgent } from "../agent.js";

/**
 * Slack channel adapter using @slack/bolt.
 *
 * Setup instructions:
 * 1. Create a Slack app at https://api.slack.com/apps
 * 2. Add OAuth scopes: channels:history, chat:write, app_mentions:read, im:history
 * 3. Enable Socket Mode and get an App-Level Token
 * 4. Install the app to your workspace — copy Bot Token and Signing Secret
 * 5. Add to .env: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_APP_TOKEN
 * 6. Install: npm install @slack/bolt
 * 7. Start the agent
 *
 * The agent listens to app_mention events and direct messages.
 */

export async function startSlack(): Promise<void> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const appToken = process.env.SLACK_APP_TOKEN;

  if (!botToken || !signingSecret) {
    throw new Error("SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET must be set in .env");
  }

  logger.info("Starting Slack channel...");

  try {
    const { App } = await import("@slack/bolt" as string);

    const app = new App({
      token: botToken,
      signingSecret,
      socketMode: !!appToken,
      appToken,
    });

    app.event("app_mention", async ({ event, say }: { event: { channel: string; text: string }; say: (text: string) => Promise<void> }) => {
      const groupId = event.channel;
      const sessionId = getOrCreateSession(groupId, "slack");
      saveMessage(sessionId, "user", event.text);

      const history = getMessageHistory(sessionId);
      const reply = await askAgent(history);

      saveMessage(sessionId, "assistant", reply);
      await say(reply);
    });

    app.message(async ({ message, say }: { message: { channel?: string; text?: string; subtype?: string }; say: (text: string) => Promise<void> }) => {
      if (message.subtype || !message.text || !message.channel) return;

      const groupId = message.channel;
      const sessionId = getOrCreateSession(groupId, "slack");
      saveMessage(sessionId, "user", message.text);

      const history = getMessageHistory(sessionId);
      const reply = await askAgent(history);

      saveMessage(sessionId, "assistant", reply);
      await say(reply);
    });

    await app.start();
    logger.info("Slack app is running");
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Cannot find module")) {
      logger.error("@slack/bolt not installed. Run: npm install @slack/bolt");
    } else {
      logger.error({ err }, "Slack channel failed to start");
    }
    throw err;
  }
}
