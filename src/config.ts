import { z } from "zod";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

const ConfigSchema = z.object({
  THINK_API_KEY: z.string().min(1, "THINK_API_KEY is required"),
  THINK_ENDPOINT: z.string().url().default("https://claudethinks.fun"),
  AGENT_NAME: z.string().default("ThinkAgent"),
  CHANNEL_TYPE: z.enum(["whatsapp", "telegram", "discord", "slack"]).default("whatsapp"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  DISCORD_TOKEN: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
  DB_PATH: z.string().default("./data/think-agent.db"),
  CONTAINER_ISOLATION: z.coerce.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Configuration error:");
    result.error.errors.forEach((e) => {
      console.error(`  ${e.path.join(".")}: ${e.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
