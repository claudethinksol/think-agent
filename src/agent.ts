import axios from "axios";
import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { logger, getAgentId } from "./index.js";

let claudeMd = "";

function loadClaudeMd(): string {
  if (claudeMd) return claudeMd;
  const claudePath = path.join(process.cwd(), "CLAUDE.md");
  if (fs.existsSync(claudePath)) {
    claudeMd = fs.readFileSync(claudePath, "utf-8");
  }
  return claudeMd;
}

export interface Message {
  role: string;
  content: string;
}

export async function askAgent(history: Message[]): Promise<string> {
  const systemPrompt = loadClaudeMd() || `You are ${config.AGENT_NAME}, an AI assistant powered by Think Agent. You are helpful, concise, and friendly.`;

  try {
    const res = await axios.post(
      `${config.THINK_ENDPOINT}/api/agent/chat`,
      {
        messages: history,
        system: systemPrompt,
        agentName: config.AGENT_NAME,
        agentId: getAgentId(),
      },
      {
        headers: {
          Authorization: `Bearer ${config.THINK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    return (res.data as { reply: string }).reply ?? "I'm sorry, I couldn't generate a response.";
  } catch (err: unknown) {
    logger.error({ err }, "Agent request failed");
    return "I'm having trouble connecting right now. Please try again in a moment.";
  }
}
