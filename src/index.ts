import pino from "pino";
import axios from "axios";
import { config } from "./config.js";
import { validateApiKey, startAuthRefresh } from "./auth.js";
import { getDb } from "./db.js";
import { startScheduler, registerSkill } from "./task-scheduler.js";
import { checkTokenPrice } from "./skills/token-price.js";
import { autoPost } from "./skills/auto-post.js";

export const logger = pino({
  level: config.LOG_LEVEL,
  transport: {
    target: "pino-pretty",
    options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
  },
});

let agentId: string | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

export function getAgentId(): string | null {
  return agentId;
}

async function registerAgent(): Promise<string> {
  const res = await axios.post(
    `${config.THINK_ENDPOINT}/api/agent/register`,
    {
      agentName: config.AGENT_NAME,
      channelType: config.CHANNEL_TYPE,
      version: "1.0.0",
    },
    {
      headers: {
        Authorization: `Bearer ${config.THINK_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );

  const data = res.data as { agentId: string; walletAddress?: string };
  logger.info({ agentId: data.agentId, walletAddress: data.walletAddress }, "Agent registered with Think platform");
  return data.agentId;
}

async function sendHeartbeat(): Promise<void> {
  if (!agentId) return;
  try {
    await axios.post(
      `${config.THINK_ENDPOINT}/api/agent/heartbeat`,
      { agentId },
      {
        headers: {
          Authorization: `Bearer ${config.THINK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    logger.debug("Heartbeat sent");
  } catch (err) {
    logger.warn({ err }, "Failed to send heartbeat");
  }
}

function startHeartbeat(): void {
  sendHeartbeat();
  heartbeatInterval = setInterval(sendHeartbeat, 60_000);
}

async function reportShutdown(): Promise<void> {
  if (!agentId) return;
  try {
    await axios.post(
      `${config.THINK_ENDPOINT}/api/agent/activity`,
      {
        agentId,
        activityType: "shutdown",
        message: `Agent ${config.AGENT_NAME} shutting down`,
      },
      {
        headers: {
          Authorization: `Bearer ${config.THINK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      }
    );
    logger.info("Shutdown activity reported");
  } catch {
    logger.warn("Failed to report shutdown activity");
  }
}

async function main(): Promise<void> {
  logger.info(`Starting Think Agent v1.0.0 — ${config.AGENT_NAME}`);
  logger.info(`Channel: ${config.CHANNEL_TYPE}`);
  logger.info(`Think Endpoint: ${config.THINK_ENDPOINT}`);

  getDb();
  logger.info("Local database initialized");

  logger.info("Validating API key...");
  const valid = await validateApiKey();
  if (!valid) {
    logger.error("API key validation failed. Please check your THINK_API_KEY and THINK_ENDPOINT.");
    logger.error("Get a new key from the dashboard: " + config.THINK_ENDPOINT + "/dashboard");
    process.exit(1);
  }
  logger.info("API key validated successfully");

  logger.info("Registering agent with Think platform...");
  try {
    agentId = await registerAgent();
  } catch (err) {
    logger.error({ err }, "Failed to register agent — continuing without registration");
  }

  startHeartbeat();

  startAuthRefresh(() => {
    logger.warn("Auth validation failed during refresh — agent continuing but may lose access");
  });

  registerSkill("token-price", checkTokenPrice);
  registerSkill("auto-post", autoPost);

  startScheduler();

  logger.info(`Starting ${config.CHANNEL_TYPE} channel...`);
  try {
    switch (config.CHANNEL_TYPE) {
      case "whatsapp": {
        const { startWhatsApp } = await import("./channels/whatsapp.js");
        await startWhatsApp();
        break;
      }
      case "telegram": {
        const { startTelegram } = await import("./channels/telegram.js");
        await startTelegram();
        break;
      }
      case "discord": {
        const { startDiscord } = await import("./channels/discord.js");
        await startDiscord();
        break;
      }
      case "slack": {
        const { startSlack } = await import("./channels/slack.js");
        await startSlack();
        break;
      }
      default: {
        logger.error(`Unknown channel type: ${config.CHANNEL_TYPE}`);
        process.exit(1);
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to start channel adapter");
    process.exit(1);
  }

  const shutdown = async (): Promise<void> => {
    logger.info("Shutting down Think Agent...");
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    await reportShutdown();
    process.exit(0);
  };
  process.on("SIGINT", () => { shutdown(); });
  process.on("SIGTERM", () => { shutdown(); });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
