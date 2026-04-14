#!/bin/bash
set -e

# ==============================================================================
# BgpMonitoring Docker Installer for Proxmox LXC
# IMPORTANT: Ensure 'Nesting' is checked in LXC Options -> Features in Proxmox!
# Supports Debian 12 / Ubuntu 22.04+ (Run as root)
# ==============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Please run as root (or with sudo)${NC}"
  exit 1
fi

echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}   BgpMonitoring - Docker LXC Installer          ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# 1. Provide a warning for Proxmox LXC Nesting
echo -e "${YELLOW}WARNING: If you are running this in a Proxmox LXC Container,${NC}"
echo -e "${YELLOW}you MUST ensure 'Nesting' is enabled in the container's Options > Features.${NC}"
echo -e "Press Enter to continue if Nesting is enabled, or Ctrl+C to abort..."
read -p ""

# 2. Update & Install Prerequisites
echo -e "${YELLOW}>> Installing OS prerequisites...${NC}"
apt-get update -y
apt-get install -y curl jq openssl git sudo ca-certificates gnupg

# 3. Install Docker & Docker Compose Plugin
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${YELLOW}>> Docker not found. Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
    rm get-docker.sh
else
    echo -e "${GREEN}>> Docker is already installed.${NC}"
fi

# Ensure docker compose plugin exists
if ! docker compose version >/dev/null 2>&1; then
    echo -e "${YELLOW}>> Installing Docker Compose plugin...${NC}"
    apt-get install -y docker-compose-plugin
fi

# 4. Prompt User Configuration
echo ""
echo -e "${BLUE}--- Configuration Setup ---${NC}"

read -p "Enter Domain Name (e.g., nms.yourdomain.com / IP Address): " APP_DOMAIN
while [[ -z "$APP_DOMAIN" ]]; do
    read -p "Enter Domain Name: " APP_DOMAIN
done

read -p "Enter Administrator Email (for Let's Encrypt SSL): " SSL_EMAIL

read -p "Enter Superadmin Username [default: superadmin]: " SA_USER
SA_USER=${SA_USER:-superadmin}

read -s -p "Enter Superadmin Password [minimum 8 characters]: " SA_PASS
echo ""

# Generate secure random strings
JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

# 5. Generate Configuration Files (.env and Caddyfile)
echo -e "${YELLOW}>> Generating configuration files...${NC}"

cat > .env <<EOF
NODE_ENV=production

# Database Credentials
POSTGRES_USER=bgpmon
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=bgpmon
DATABASE_URL=postgresql://bgpmon:${POSTGRES_PASSWORD}@postgres:5432/bgpmon

# Redis
REDIS_URL=redis://redis:6379

# Notifications
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# App Secrets
JWT_SECRET=${JWT_SECRET}
SUPERADMIN_USERNAME=${SA_USER}
SUPERADMIN_PASSWORD=${SA_PASS}
EOF

cat > Caddyfile <<EOF
{
    email ${SSL_EMAIL}
}

${APP_DOMAIN} {
    reverse_proxy librenms_dashboard:3000
    
    # Compress responses
    encode zstd gzip
    
    # Basic Security Headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options nosniff
        X-Frame-Options SAMEORIGIN
        Referrer-Policy strict-origin-when-cross-origin
    }
}
EOF

# 6. Build and Deploy Containers
echo -e "${YELLOW}>> Bringing up the Docker stack...${NC}"

# Bring down existing if any
docker compose down 2>/dev/null || true

# Pull, build and start
docker compose up -d --build

echo ""
echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN} 🎉 DOCKER INSTALLATION COMPLETE!                ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo -e "Your monitoring platform is now running via Docker."
echo -e "Access your application at:  ${GREEN}https://${APP_DOMAIN}${NC}"
echo -e "Login Username:              ${GREEN}${SA_USER}${NC}"
echo -e ""
echo -e "To view logs, type:          ${YELLOW}docker compose logs -f${NC}"
echo -e "${BLUE}=================================================${NC}"
