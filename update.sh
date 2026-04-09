#!/bin/bash
set -e

# ==============================================================================
# BgpMonitoring Automated Updater
# Run this script to update your existing installation to the latest version.
# ==============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}   BgpMonitoring - Auto Update Script            ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# 1. Sanity Checks
# ------------------------------------------------------------------------------
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found! Are you in the correct directory?${NC}"
    echo -e "${YELLOW}If this is a new installation, please run ./install.sh instead.${NC}"
    exit 1
fi

COMPOSE_COMMAND="docker-compose"
if docker compose version >/dev/null 2>&1; then
    COMPOSE_COMMAND="docker compose"
fi

# 2. Pull Latest Changes
# ------------------------------------------------------------------------------
echo -e "${YELLOW}>> Fetching latest updates from GitHub...${NC}"
git fetch origin main
git reset --hard origin/main

# Ensure scripts remain executable after pull
chmod +x install.sh update.sh 2>/dev/null || true

# 3. Rebuild and Deploy
# ------------------------------------------------------------------------------
echo -e "${YELLOW}>> Rebuilding and updating Docker containers...${NC}"

# We use build to ensure package.json or dependency changes are compiled
sudo $COMPOSE_COMMAND up -d --build

# 4. Cleanup
# ------------------------------------------------------------------------------
echo -e "${YELLOW}>> Cleaning up old docker images...${NC}"
sudo docker image prune -f

echo ""
echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN} 🎉 UPDATE COMPLETE!                             ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo -e "Your monitoring platform has been updated successfully."
echo -e "To view logs:  sudo $COMPOSE_COMMAND logs -f"
echo -e "${BLUE}=================================================${NC}"
