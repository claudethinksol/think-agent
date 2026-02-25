import axios from "axios";
import { logger, getAgentId } from "../index.js";
import { config } from "../config.js";

const CLAWPUMP_API = "https://www.clawpump.tech";
const CLAWPUMP_AGENT_ID = process.env.CLAWPUMP_AGENT_ID ?? "";

interface EarningsResponse {
  totalEarnings?: number;
  pendingPayout?: number;
  walletAddress?: string;
  [key: string]: unknown;
}

async function reportActivity(activityType: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
  try {
    await axios.post(
      `${config.THINK_ENDPOINT}/api/agent/activity`,
      { agentId: getAgentId(), activityType, message, metadata: metadata ? JSON.stringify(metadata) : undefined },
      { headers: { Authorization: `Bearer ${config.THINK_API_KEY}` }, timeout: 10000 }
    );
  } catch (err) {
    logger.warn({ err }, "Failed to report activity to Think API");
  }
}

export async function checkEarnings(): Promise<EarningsResponse | null> {
  if (!CLAWPUMP_AGENT_ID) {
    logger.warn("CLAWPUMP_AGENT_ID not set, skipping earnings check");
    return null;
  }

  try {
    const res = await axios.get(`${CLAWPUMP_API}/api/fees/earnings`, {
      headers: { "X-Agent-Id": CLAWPUMP_AGENT_ID },
      timeout: 15000,
    });

    const data = res.data as EarningsResponse;
    logger.info({ data }, "ClawPump earnings fetched");

    await reportActivity("clawpump_earnings", `Earnings check: ${data.totalEarnings ?? 0} SOL total, ${data.pendingPayout ?? 0} SOL pending`, {
      totalEarnings: data.totalEarnings,
      pendingPayout: data.pendingPayout,
    });

    return data;
  } catch (err) {
    logger.error({ err }, "Failed to check ClawPump earnings");
    return null;
  }
}

export async function registerPayoutWallet(walletAddress: string): Promise<boolean> {
  if (!CLAWPUMP_AGENT_ID) {
    logger.warn("CLAWPUMP_AGENT_ID not set, cannot register payout wallet");
    return false;
  }

  try {
    await axios.put(
      `${CLAWPUMP_API}/api/fees/wallet`,
      { walletAddress },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Id": CLAWPUMP_AGENT_ID,
        },
        timeout: 15000,
      }
    );

    logger.info({ walletAddress }, "Payout wallet registered on ClawPump");

    await reportActivity("clawpump_earnings", `Registered payout wallet: ${walletAddress}`, { walletAddress });

    return true;
  } catch (err) {
    logger.error({ err }, "Failed to register payout wallet");
    return false;
  }
}
