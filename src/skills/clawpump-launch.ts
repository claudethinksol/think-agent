import axios from "axios";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import { logger, getAgentId } from "../index.js";
import { config } from "../config.js";

const CLAWPUMP_API = "https://www.clawpump.tech";
const CLAWPUMP_AGENT_ID = process.env.CLAWPUMP_AGENT_ID ?? "";

interface UploadResponse {
  url: string;
  [key: string]: unknown;
}

interface LaunchResponse {
  tokenAddress?: string;
  mint?: string;
  txHash?: string;
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

export async function uploadImage(imagePath: string): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(path.resolve(imagePath)));

    const res = await axios.post(`${CLAWPUMP_API}/api/upload`, form, {
      headers: {
        ...form.getHeaders(),
        ...(CLAWPUMP_AGENT_ID ? { "X-Agent-Id": CLAWPUMP_AGENT_ID } : {}),
      },
      timeout: 30000,
    });

    const data = res.data as UploadResponse;
    logger.info({ url: data.url }, "Image uploaded to ClawPump");
    return data.url ?? null;
  } catch (err) {
    logger.error({ err }, "Failed to upload image to ClawPump");
    return null;
  }
}

export interface LaunchTokenParams {
  name: string;
  symbol: string;
  description: string;
  imagePath: string;
  selfFunded?: boolean;
  fundAmount?: number;
}

export async function launchToken(params: LaunchTokenParams): Promise<LaunchResponse | null> {
  const { name, symbol, description, imagePath, selfFunded, fundAmount } = params;

  const imageUrl = await uploadImage(imagePath);
  if (!imageUrl) {
    logger.error("Cannot launch token without uploaded image");
    return null;
  }

  try {
    const payload: Record<string, unknown> = {
      name,
      symbol,
      description,
      imageUrl,
      ...(CLAWPUMP_AGENT_ID ? { agentId: CLAWPUMP_AGENT_ID } : {}),
    };

    if (selfFunded && fundAmount) {
      payload.selfFunded = true;
      payload.fundAmount = fundAmount;
    }

    const res = await axios.post(`${CLAWPUMP_API}/api/launch`, payload, {
      headers: {
        "Content-Type": "application/json",
        ...(CLAWPUMP_AGENT_ID ? { "X-Agent-Id": CLAWPUMP_AGENT_ID } : {}),
      },
      timeout: 60000,
    });

    const data = res.data as LaunchResponse;
    logger.info({ data }, "Token launched on ClawPump");

    await reportActivity("clawpump_launch", `Launched token ${name} (${symbol}) on ClawPump`, {
      name,
      symbol,
      tokenAddress: data.tokenAddress ?? data.mint,
      txHash: data.txHash,
      selfFunded: selfFunded ?? false,
    });

    return data;
  } catch (err) {
    logger.error({ err }, "Failed to launch token on ClawPump");
    await reportActivity("clawpump_launch", `Failed to launch token ${name} (${symbol})`, { error: String(err) });
    return null;
  }
}
