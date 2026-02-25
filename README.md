# Think Agent

The first AI agent token — self-hosted, multi-channel.

Think Agent is the official AI agent runner for the Think ecosystem. It runs Claude-powered AI agents in isolated Docker containers and connects them to WhatsApp, Telegram, Discord, or Slack.

## Features

- **Multi-channel support** — WhatsApp, Telegram, Discord, Slack
- **Container isolation** — Each agent task runs in its own Docker container
- **Per-group memory** — Isolated SQLite storage per chat group/channel
- **Scheduled tasks** — Cron-style automation (price checks, auto-posting)
- **Token price monitoring** — Live DexScreener integration for THINK and any token
- **Auto-posting to X** — AI-generated content posted on schedule
- **Agent swarms** — Multiple agents collaborating via the Think API
- **Custom skills** — Drop a `.ts` file in `src/skills/` to add new capabilities
- **Self-healing** — Auto-reconnect on disconnect, error recovery with retry logic
- **Centralized auth** — All agents authenticate through Think's API endpoint with bearer keys

## Quick Start

### One-Command Setup

```bash
git clone https://github.com/claudethinksol/think-agent.git
cd think-agent
bash setup.sh
```

The setup script will:
1. Check your environment (Node.js, Docker)
2. Install dependencies
3. Walk you through interactive configuration
4. Validate your API key against the Think endpoint
5. Build the TypeScript source

### Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API key and channel credentials

# 3. Build
npm run build

# 4. Start
npm start
```

### Docker Compose

```bash
# Configure .env first
cp .env.example .env
# Edit .env

# Start with Docker
docker-compose up -d

# View logs
docker-compose logs -f
```

## Configuration

Edit `.env` (or `docker-compose.yml` environment section):

| Variable | Required | Description |
|----------|----------|-------------|
| `THINK_API_KEY` | Yes | Your API key from the dashboard |
| `THINK_ENDPOINT` | Yes | Think API URL (default: https://claudethinks.fun) |
| `AGENT_NAME` | No | Display name for your agent (default: ThinkAgent) |
| `CHANNEL_TYPE` | Yes | `whatsapp`, `telegram`, `discord`, or `slack` |
| `TELEGRAM_BOT_TOKEN` | If Telegram | From @BotFather |
| `DISCORD_TOKEN` | If Discord | From Discord Developer Portal |
| `SLACK_BOT_TOKEN` | If Slack | From api.slack.com/apps |
| `THINK_TOKEN_ADDRESS` | No | Token address for price monitoring |
| `CLAWPUMP_AGENT_ID` | No | Your ClawPump agent ID for token launching, earnings, swaps |
| `CONTAINER_ISOLATION` | No | Enable Docker task isolation (default: false) |

## Channel Setup

### WhatsApp
1. Run the agent — a QR code appears in terminal
2. Open WhatsApp → Linked Devices → Link a Device
3. Scan the QR code
4. Install extra dep: `npm install whatsapp-web.js puppeteer`

### Telegram
1. Create bot via @BotFather → get token
2. Add `TELEGRAM_BOT_TOKEN` to `.env`
3. Add bot to your group(s)
4. Install: `npm install node-telegram-bot-api`

### Discord
1. Create app at discord.com/developers/applications
2. Add bot, enable "Message Content Intent"
3. Add `DISCORD_TOKEN` to `.env`
4. Invite bot to your server
5. Install: `npm install discord.js`

### Slack
1. Create app at api.slack.com/apps
2. Add OAuth scopes, enable Socket Mode
3. Add credentials to `.env`
4. Install: `npm install @slack/bolt`

## ClawPump Integration

Think Agent includes built-in skills for [ClawPump](https://www.clawpump.tech) — the gasless token launchpad on Solana. Set `CLAWPUMP_AGENT_ID` in your `.env` to enable these capabilities.

### Available ClawPump Skills

| Skill | File | Description |
|-------|------|-------------|
| Token Launch | `clawpump-launch.ts` | Upload image + launch token on ClawPump with optional self-funding |
| Earnings | `clawpump-earnings.ts` | Check fee earnings and register payout wallet |
| Swap | `clawpump-swap.ts` | Execute token swaps via ClawPump swap API |
| Tokens | `clawpump-tokens.ts` | List tokens, get details, leaderboard, platform stats |

### Usage

```typescript
import { launchToken } from "./skills/clawpump-launch.js";
import { checkEarnings, registerPayoutWallet } from "./skills/clawpump-earnings.js";
import { swapTokens } from "./skills/clawpump-swap.js";
import { listTokens, getLeaderboard, getPlatformStats } from "./skills/clawpump-tokens.js";

// Launch a token
await launchToken({
  name: "My Token",
  symbol: "MTK",
  description: "A token launched by Think Agent",
  imagePath: "./assets/token-logo.png",
  selfFunded: true,
  fundAmount: 0.5,
});

// Check earnings
const earnings = await checkEarnings();

// Register payout wallet
await registerPayoutWallet("YourSolanaWalletAddress...");

// Swap tokens
await swapTokens({ tokenIn: "SOL", tokenOut: "MINT_ADDRESS", amount: 1.0, slippage: 1 });

// Browse tokens
const tokens = await listTokens();
const leaderboard = await getLeaderboard();
const stats = await getPlatformStats();
```

All ClawPump skill actions are automatically reported back to the Think API activity feed.

## Custom Skills

Add a file to `src/skills/`:

```typescript
// src/skills/my-skill.ts
export async function mySkill(): Promise<void> {
  // Your skill logic here
  console.log("Running my custom skill");
}
```

Register it in `src/index.ts`:

```typescript
import { mySkill } from "./skills/my-skill.js";
registerSkill("my-skill", mySkill);
```

Schedule it:

```typescript
addScheduledTask("my-task", "My Scheduled Task", "0 * * * *", "my-skill");
```

## Architecture

```
Think Agent (your server / Docker container)
    │
    ├── Channel Adapter (WhatsApp / Telegram / Discord / Slack)
    │       └── Receives messages, sends replies
    │
    ├── Local SQLite DB
    │       └── Per-group message history & state
    │
    ├── Task Scheduler (cron)
    │       └── Price checks, auto-posting, custom tasks
    │
    └── Think API (bearer key auth)
            ├── POST /api/agent/chat  → AI responses via Claude
            ├── GET  /api/validate-key → Auth validation
            └── Central dashboard & management
```

## API Reference

Your agent authenticates with the Think API using your bearer key:

```http
Authorization: Bearer YOUR_THINK_API_KEY
```

**Validate Key**
```
GET /api/validate-key
```
Returns `200 OK` with `{"valid": true}` if the key is active.

**Agent Chat**
```
POST /api/agent/chat
Content-Type: application/json

{
  "messages": [{"role": "user", "content": "Hello"}],
  "system": "You are a helpful assistant",
  "agentName": "MyAgent"
}
```

## Troubleshooting

**API key invalid**
- Generate a new key from the dashboard: `/dashboard`
- Ensure there are no trailing spaces in `.env`

**WhatsApp QR not appearing**
- Install Puppeteer: `npm install puppeteer`
- Try: `npx puppeteer browsers install chrome`

**Cannot reach Think endpoint**
- Check your internet connection
- Verify `THINK_ENDPOINT` in `.env`
- The agent will retry automatically on the next cycle

**Docker not available**
- Set `CONTAINER_ISOLATION=false` in `.env`
- Install Docker from docker.com if you need full isolation

**Agent not responding in group**
- WhatsApp: Ensure the linked device is still connected (QR may have expired)
- Telegram: Ensure the bot has been added to the group and has send message permission
- Discord: Check bot permissions (Read Messages, Send Messages, Message Content Intent)
- Slack: Verify OAuth scopes and that the app is installed in the workspace

## License

MIT — fork it, customize it, make it yours.

---

Built on the Think ecosystem. [Dashboard](https://claudethinks.fun/dashboard) · [Docs](https://claudethinks.fun/docs)
