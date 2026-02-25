import axios from "axios";
import { logger, getAgentId } from "../index.js";
import { config } from "../config.js";

/**
 * Auto-Post to X/Twitter Skill
 *
 * Automatically generates and posts content to X (Twitter) using the Twitter API v2.
 * Requires Twitter API credentials in .env.
 *
 * Required env vars:
 *   TWITTER_API_KEY, TWITTER_API_SECRET
 *   TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
 *
 * Usage:
 *   import { autoPost } from "./skills/auto-post.js";
 *   registerSkill("auto-post", autoPost);
 *   addScheduledTask("daily-post", "Daily Think Post", "0 12 * * *", "auto-post");
 */

const POST_TEMPLATES = [
  `🤖 Think Agent is live! AI agents running on-chain, watching markets, and helping communities 24/7. #ThinkAgent #AI #Crypto`,
  `📊 THINK token update — your AI agent is watching the markets. Self-host at: ${config.THINK_ENDPOINT}/docs #Think #DeFi`,
  `🧠 Think Agent: The first AI agent token. Multi-channel support, isolated containers, custom skills. #ThinkAgent`,
  `⚡ Autonomous AI agents for WhatsApp, Telegram, Discord & Slack. Powered by Think. #AI #Web3`,
];

async function generatePost(): Promise<string> {
  try {
    const res = await axios.post(
      `${config.THINK_ENDPOINT}/api/agent/chat`,
      {
        messages: [{ role: "user", content: "Write a short engaging tweet (max 280 chars) about Think Agent — the AI agent token on ClawPump. Include relevant hashtags." }],
        system: "You are a crypto marketing AI. Write concise, engaging social media posts.",
        agentName: config.AGENT_NAME,
        agentId: getAgentId(),
      },
      {
        headers: { Authorization: `Bearer ${config.THINK_API_KEY}` },
        timeout: 15000,
      }
    );
    return (res.data as { reply: string }).reply?.slice(0, 280) ?? getRandomTemplate();
  } catch {
    return getRandomTemplate();
  }
}

function getRandomTemplate(): string {
  return POST_TEMPLATES[Math.floor(Math.random() * POST_TEMPLATES.length)];
}

async function postToTwitter(text: string): Promise<void> {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    logger.warn("Twitter credentials not configured — skipping post");
    logger.info({ text }, "Would have posted");
    return;
  }

  try {
    await axios.post(
      "https://api.twitter.com/2/tweets",
      { text },
      {
        headers: {
          "Content-Type": "application/json",
        },
        auth: {
          username: apiKey,
          password: apiSecret,
        },
      }
    );
    logger.info({ text }, "Posted to Twitter/X");
  } catch (err) {
    logger.error({ err }, "Failed to post to Twitter/X");
  }
}

export async function autoPost(): Promise<void> {
  logger.info("Running auto-post skill");
  const text = await generatePost();
  await postToTwitter(text);
}
