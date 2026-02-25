import axios from "axios";
import { logger, getAgentId } from "../index.js";
import { config } from "../config.js";

const CLAWPUMP_API = "https://www.clawpump.tech";
const CLAWPUMP_AGENT_ID = process.env.CLAWPUMP_AGENT_ID ?? "";

interface SwapResponse {
  txHash?: string;
  amountOut?: number;
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

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amount: number;
  slippage?: number;
}

export async function swapTokens(params: SwapParams): Promise<SwapResponse | null> {
  const { tokenIn, tokenOut, amount, slippage } = params;

  try {
    const payload: Record<string, unknown> = {
      tokenIn,
      tokenOut,
      amount,
      ...(slippage !== undefined ? { slippage } : {}),
      ...(CLAWPUMP_AGENT_ID ? { agentId: CLAWPUMP_AGENT_ID } : {}),
    };

    const res = await axios.post(`${CLAWPUMP_API}/api/swap`, payload, {
      headers: {
        "Content-Type": "application/json",
        ...(CLAWPUMP_AGENT_ID ? { "X-Agent-Id": CLAWPUMP_AGENT_ID } : {}),
      },
      timeout: 60000,
    });

    const data = res.data as SwapResponse;
    logger.info({ data }, "Token swap executed on ClawPump");

    await reportActivity("swap", `Swapped ${amount} ${tokenIn} → ${tokenOut} on ClawPump`, {
      tokenIn,
      tokenOut,
      amount,
      slippage,
      txHash: data.txHash,
      amountOut: data.amountOut,
    });

    return data;
  } catch (err) {
    logger.error({ err }, "Failed to execute swap on ClawPump");
    await reportActivity("swap", `Failed swap: ${amount} ${tokenIn} → ${tokenOut}`, { error: String(err) });
    return null;
  }
}
