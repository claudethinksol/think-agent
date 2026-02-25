#!/usr/bin/env bash
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ████████╗██╗  ██╗██╗███╗   ██╗██╗  ██╗"
echo "     ██╔══╝██║  ██║██║████╗  ██║██║ ██╔╝"
echo "     ██║   ███████║██║██╔██╗ ██║█████╔╝ "
echo "     ██║   ██╔══██║██║██║╚██╗██║██╔═██╗ "
echo "     ██║   ██║  ██║██║██║ ╚████║██║  ██╗"
echo "     ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝"
echo -e "${NC}"
echo -e "${CYAN}Think Agent Setup${NC}"
echo "========================================"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}[ERROR] Node.js is not installed. Please install Node.js >= 20.${NC}"
  exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo -e "${RED}[ERROR] Node.js >= 20 required. Found: $(node -v)${NC}"
  exit 1
fi
echo -e "${GREEN}[OK] Node.js $(node -v) detected${NC}"

# Check Docker (optional, warn if missing)
if command -v docker &> /dev/null; then
  echo -e "${GREEN}[OK] Docker detected — container isolation enabled${NC}"
  DOCKER_AVAILABLE=true
else
  echo -e "${YELLOW}[WARN] Docker not found — container isolation disabled. Install Docker for full isolation.${NC}"
  DOCKER_AVAILABLE=false
fi

# Install dependencies
echo ""
echo -e "${CYAN}Installing dependencies...${NC}"
npm install

# Interactive configuration
echo ""
echo -e "${CYAN}Configuration Setup${NC}"
echo "----------------------------------------"

ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}[WARN] .env file already exists. Skipping config (delete .env to reconfigure).${NC}"
else
  read -rp "Enter your Think API Key (from dashboard): " THINK_API_KEY
  if [ -z "$THINK_API_KEY" ]; then
    echo -e "${RED}[ERROR] API key is required.${NC}"
    exit 1
  fi

  read -rp "Enter Think API Endpoint [https://claudethinks.fun]: " THINK_ENDPOINT
  THINK_ENDPOINT="${THINK_ENDPOINT:-https://claudethinks.fun}"

  read -rp "Enter Agent Name [ThinkAgent]: " AGENT_NAME
  AGENT_NAME="${AGENT_NAME:-ThinkAgent}"

  echo "Choose channel type:"
  echo "  1) whatsapp"
  echo "  2) telegram"
  echo "  3) discord"
  echo "  4) slack"
  read -rp "Select [1-4]: " CHANNEL_CHOICE
  case "$CHANNEL_CHOICE" in
    1) CHANNEL_TYPE="whatsapp" ;;
    2) CHANNEL_TYPE="telegram" ;;
    3) CHANNEL_TYPE="discord" ;;
    4) CHANNEL_TYPE="slack" ;;
    *) CHANNEL_TYPE="whatsapp" ;;
  esac

  cat > "$ENV_FILE" <<EOF
THINK_API_KEY=$THINK_API_KEY
THINK_ENDPOINT=$THINK_ENDPOINT
AGENT_NAME=$AGENT_NAME
CHANNEL_TYPE=$CHANNEL_TYPE
EOF

  echo -e "${GREEN}[OK] Configuration saved to .env${NC}"
fi

# Validate API key against Think endpoint
echo ""
echo -e "${CYAN}Validating API key...${NC}"
source "$ENV_FILE"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $THINK_API_KEY" \
  "$THINK_ENDPOINT/api/validate-key" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}[OK] API key validated successfully${NC}"
elif [ "$HTTP_STATUS" = "000" ]; then
  echo -e "${YELLOW}[WARN] Could not reach Think endpoint — check your internet connection or endpoint URL${NC}"
  echo -e "${YELLOW}       The agent will attempt to validate on startup.${NC}"
else
  echo -e "${RED}[ERROR] API key validation failed (HTTP $HTTP_STATUS). Check your API key.${NC}"
  exit 1
fi

# Build TypeScript
echo ""
echo -e "${CYAN}Building TypeScript...${NC}"
npm run build

echo ""
echo -e "${GREEN}========================================"
echo "  Think Agent setup complete!"
echo "========================================"
echo -e "${NC}"
echo "To start your agent:"
echo -e "  ${CYAN}npm start${NC}"
echo ""
if [ "$CHANNEL_TYPE" = "whatsapp" ]; then
  echo "A QR code will appear — scan it with WhatsApp to connect."
elif [ "$CHANNEL_TYPE" = "telegram" ]; then
  echo "Add your bot token to .env as TELEGRAM_BOT_TOKEN."
elif [ "$CHANNEL_TYPE" = "discord" ]; then
  echo "Add your Discord bot token to .env as DISCORD_TOKEN."
elif [ "$CHANNEL_TYPE" = "slack" ]; then
  echo "Add your Slack app credentials to .env (SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET)."
fi
echo ""
echo "For full documentation, visit: $THINK_ENDPOINT/docs"
