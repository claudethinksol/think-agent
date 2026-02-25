import axios from "axios";
import { logger } from "../index.js";

/**
 * Token Price Monitoring Skill
 *
 * Uses DexScreener API to fetch real-time token prices.
 * Schedule this skill to run periodically and post updates to your channel.
 *
 * Usage:
 *   import { checkTokenPrice } from "./skills/token-price.js";
 *   registerSkill("token-price", checkTokenPrice);
 *   addScheduledTask("price-check", "Token Price Check", "0 * * * *", "token-price");
 */

export interface TokenData {
  name: string;
  symbol: string;
  priceUsd: string;
  priceChange24h: number;
  liquidity: number;
  volume24h: number;
  fdv: number;
  url: string;
}

const THINK_TOKEN_ADDRESS = process.env.THINK_TOKEN_ADDRESS ?? "";
const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens";

export async function fetchTokenPrice(tokenAddress: string): Promise<TokenData | null> {
  try {
    const res = await axios.get(`${DEXSCREENER_API}/${tokenAddress}`, { timeout: 10000 });
    const data = res.data as { pairs?: Array<{
      baseToken: { name: string; symbol: string };
      priceUsd: string;
      priceChange: { h24: number };
      liquidity: { usd: number };
      volume: { h24: number };
      fdv: number;
      url: string;
    }> };

    if (!data.pairs || data.pairs.length === 0) return null;

    const pair = data.pairs[0];
    return {
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      priceUsd: pair.priceUsd,
      priceChange24h: pair.priceChange?.h24 ?? 0,
      liquidity: pair.liquidity?.usd ?? 0,
      volume24h: pair.volume?.h24 ?? 0,
      fdv: pair.fdv ?? 0,
      url: pair.url,
    };
  } catch (err) {
    logger.error({ err, tokenAddress }, "Failed to fetch token price");
    return null;
  }
}

export async function checkTokenPrice(): Promise<void> {
  if (!THINK_TOKEN_ADDRESS) {
    logger.warn("THINK_TOKEN_ADDRESS not set, skipping price check");
    return;
  }

  const data = await fetchTokenPrice(THINK_TOKEN_ADDRESS);
  if (!data) {
    logger.warn("No price data available");
    return;
  }

  const emoji = data.priceChange24h >= 0 ? "📈" : "📉";
  const change = data.priceChange24h >= 0 ? `+${data.priceChange24h.toFixed(2)}%` : `${data.priceChange24h.toFixed(2)}%`;

  const message = [
    `${emoji} *${data.name} (${data.symbol}) Price Update*`,
    `Price: $${parseFloat(data.priceUsd).toFixed(8)}`,
    `24h Change: ${change}`,
    `Volume (24h): $${(data.volume24h / 1000).toFixed(1)}K`,
    `Liquidity: $${(data.liquidity / 1000).toFixed(1)}K`,
    `FDV: $${(data.fdv / 1000).toFixed(1)}K`,
    `Chart: ${data.url}`,
  ].join("\n");

  logger.info({ message }, "Token price update");
}
