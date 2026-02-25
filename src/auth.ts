import axios from "axios";
import { config } from "./config.js";
import { logger } from "./index.js";

const VALIDATION_INTERVAL_MS = 30 * 60 * 1000;

export async function validateApiKey(): Promise<boolean> {
  try {
    const res = await axios.get(`${config.THINK_ENDPOINT}/api/validate-key`, {
      headers: { Authorization: `Bearer ${config.THINK_API_KEY}` },
      timeout: 10000,
    });
    return res.status === 200;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 401) {
        logger.error("API key is invalid or revoked. Please generate a new key from the dashboard.");
      } else if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") {
        logger.warn("Could not reach Think endpoint — will retry on next cycle.");
      } else {
        logger.error({ err }, "API key validation failed");
      }
    }
    return false;
  }
}

export function startAuthRefresh(onInvalid: () => void): NodeJS.Timeout {
  return setInterval(async () => {
    const valid = await validateApiKey();
    if (!valid) {
      logger.warn("API key validation failed during refresh — agent will pause until key is valid.");
      onInvalid();
    } else {
      logger.debug("API key refreshed successfully");
    }
  }, VALIDATION_INTERVAL_MS);
}
