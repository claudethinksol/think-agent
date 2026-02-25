import qrcodeTerminal from "qrcode-terminal";
import { logger } from "../index.js";
import { getOrCreateSession, saveMessage, getMessageHistory } from "../db.js";
import { askAgent } from "../agent.js";

/**
 * WhatsApp channel adapter using whatsapp-web.js (Baileys alternative).
 *
 * Setup instructions:
 * 1. Install: npm install whatsapp-web.js puppeteer
 * 2. Run the agent — a QR code will appear in the terminal
 * 3. Open WhatsApp on your phone → Linked Devices → Link a Device
 * 4. Scan the QR code
 * 5. The agent is now live in all your WhatsApp groups
 *
 * The agent responds to messages in groups where it is a participant.
 * Per-group memory is isolated using local SQLite storage.
 */

export async function startWhatsApp(): Promise<void> {
  logger.info("Starting WhatsApp channel...");

  try {
    // Dynamic import to avoid hard dependency — install whatsapp-web.js to enable
    const { Client, LocalAuth } = await import("whatsapp-web.js" as string);

    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: "./data/whatsapp-auth" }),
      puppeteer: { headless: true, args: ["--no-sandbox"] },
    });

    client.on("qr", (qr: string) => {
      logger.info("Scan the QR code below with WhatsApp:");
      qrcodeTerminal.generate(qr, { small: true });
    });

    client.on("ready", () => {
      logger.info("WhatsApp client is ready");
    });

    client.on("message", async (msg: { from: string; body: string; reply: (text: string) => Promise<void> }) => {
      if (!msg.body || msg.from === "status@broadcast") return;

      const groupId = msg.from;
      const sessionId = getOrCreateSession(groupId, "whatsapp");
      saveMessage(sessionId, "user", msg.body);

      const history = getMessageHistory(sessionId);
      const reply = await askAgent(history);

      saveMessage(sessionId, "assistant", reply);
      await msg.reply(reply);
    });

    client.on("disconnected", (reason: string) => {
      logger.warn({ reason }, "WhatsApp disconnected, attempting reconnect...");
      setTimeout(() => client.initialize(), 5000);
    });

    await client.initialize();
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Cannot find module")) {
      logger.error("whatsapp-web.js not installed. Run: npm install whatsapp-web.js puppeteer");
    } else {
      logger.error({ err }, "WhatsApp channel failed to start");
    }
    throw err;
  }
}
