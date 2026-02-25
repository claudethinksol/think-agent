import axios from "axios";
import { logger } from "../index.js";

const CLAWPUMP_API = "https://www.clawpump.tech";

export interface ClawPumpToken {
  mint?: string;
  name?: string;
  symbol?: string;
  imageUrl?: string;
  marketCap?: number;
  price?: number;
  [key: string]: unknown;
}

export interface PlatformStats {
  totalTokens?: number;
  totalVolume?: number;
  totalUsers?: number;
  [key: string]: unknown;
}

export async function listTokens(page = 1, limit = 20): Promise<ClawPumpToken[]> {
  try {
    const res = await axios.get(`${CLAWPUMP_API}/api/tokens`, {
      params: { page, limit },
      timeout: 15000,
    });

    const data = res.data as ClawPumpToken[] | { tokens: ClawPumpToken[] };
    const tokens = Array.isArray(data) ? data : (data.tokens ?? []);
    logger.info({ count: tokens.length }, "Fetched ClawPump token list");
    return tokens;
  } catch (err) {
    logger.error({ err }, "Failed to list ClawPump tokens");
    return [];
  }
}

export async function getTokenDetails(mint: string): Promise<ClawPumpToken | null> {
  try {
    const res = await axios.get(`${CLAWPUMP_API}/api/tokens/${mint}`, { timeout: 15000 });
    const data = res.data as ClawPumpToken;
    logger.info({ mint, name: data.name }, "Fetched ClawPump token details");
    return data;
  } catch (err) {
    logger.error({ err, mint }, "Failed to get token details");
    return null;
  }
}

export async function getLeaderboard(): Promise<ClawPumpToken[]> {
  try {
    const res = await axios.get(`${CLAWPUMP_API}/api/leaderboard`, { timeout: 15000 });
    const data = res.data as ClawPumpToken[] | { tokens: ClawPumpToken[] };
    const tokens = Array.isArray(data) ? data : (data.tokens ?? []);
    logger.info({ count: tokens.length }, "Fetched ClawPump leaderboard");
    return tokens;
  } catch (err) {
    logger.error({ err }, "Failed to fetch leaderboard");
    return [];
  }
}

export async function getPlatformStats(): Promise<PlatformStats | null> {
  try {
    const res = await axios.get(`${CLAWPUMP_API}/api/stats`, { timeout: 15000 });
    const data = res.data as PlatformStats;
    logger.info({ data }, "Fetched ClawPump platform stats");
    return data;
  } catch (err) {
    logger.error({ err }, "Failed to fetch platform stats");
    return null;
  }
}
