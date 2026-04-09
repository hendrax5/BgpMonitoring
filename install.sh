#!/bin/bash
set -e

# ==============================================================================
# BgpMonitoring Automated Installer
# Supports Debian/Ubuntu and CentOS/RHEL/Rocky Linux.
# ==============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}   BgpMonitoring - Secure Auto-Deploy Script     ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# 0. SAFETY CHECK
# ------------------------------------------------------------------------------
if [ -f .env ]; then
    echo -e "${RED}Error: .env file already exists!${NC}"
    echo -e "${YELLOW}It looks like BgpMonitoring is already installed.${NC}"
    echo -e "${YELLOW}To update an existing installation, please run: ./update.sh${NC}"
    exit 1
fi

# 1. OS DETECTION & PREREQUISITES
# ------------------------------------------------------------------------------
echo -e "${YELLOW}>> Checking OS and prerequisites...${NC}"

if command -v apt-get >/dev/null 2>&1; then
    PKG_MGR="apt-get"
    sudo apt-get update -y
    sudo apt-get install -y curl jq openssl
elif command -v dnf >/dev/null 2>&1; then
    PKG_MGR="dnf"
    sudo dnf install -y curl jq openssl
elif command -v yum >/dev/null 2>&1; then
    PKG_MGR="yum"
    sudo yum install -y curl jq openssl
else
    echo -e "${RED}Error: Unsupported OS. Please install Docker and curl manually.${NC}"
    exit 1
fi

# Install Docker if missing
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${YELLOW}>> Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo systemctl enable docker
    sudo systemctl start docker
    rm get-docker.sh
else
    echo -e "${GREEN}>> Docker is already installed.${NC}"
fi

# Install Docker Compose if missing
if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
    echo -e "${YELLOW}>> Installing Docker Compose...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    echo -e "${GREEN}>> Docker Compose is already installed.${NC}"
fi

COMPOSE_COMMAND="docker-compose"
if docker compose version >/dev/null 2>&1; then
    COMPOSE_COMMAND="docker compose"
fi

# 2. USER PROMPTS & CONFIGURATION
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}--- Configuration Setup ---${NC}"

read -p "Enter Domain Name (e.g., nms.yourdomain.com): " APP_DOMAIN
while [[ -z "$APP_DOMAIN" ]]; do
    echo -e "${RED}Domain name is required for HTTPS setup.${NC}"
    read -p "Enter Domain Name: " APP_DOMAIN
done

read -p "Enter Administrator Email (for Let's Encrypt SSL): " SSL_EMAIL
while [[ -z "$SSL_EMAIL" ]]; do
    echo -e "${RED}Email is required for SSL recovery.${NC}"
    read -p "Enter Administrator Email: " SSL_EMAIL
done

read -p "Enter Superadmin Username [default: superadmin]: " SA_USER
SA_USER=${SA_USER:-superadmin}

read -s -p "Enter Superadmin Password [minimum 8 characters]: " SA_PASS
echo ""
while [[ ${#SA_PASS} -lt 8 ]]; do
    echo -e "${RED}Password must be at least 8 characters long.${NC}"
    read -s -p "Enter Superadmin Password: " SA_PASS
    echo ""
done

# 3. GENERATING .ENV AND CADDYFILE
# ------------------------------------------------------------------------------
echo -e "${YELLOW}>> Generating secure credentials and writing config files...${NC}"

# Generate secure random strings
JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

# Create .env
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

# Create Caddyfile
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

echo -e "${GREEN}>> Configuration files (.env, Caddyfile) created successfully!${NC}"

# 4. DEPLOYMENT
# ------------------------------------------------------------------------------
echo -e "${YELLOW}>> Bringing up the Docker stack...${NC}"

# Stop any running instances
sudo $COMPOSE_COMMAND down 2>/dev/null || true

# Build and start the stack
sudo $COMPOSE_COMMAND up -d --build

echo ""
echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN} 🎉 INSTALLATION COMPLETE!                       ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo -e "Your monitoring platform is now deploying."
echo -e "Wait 1-2 minutes for the database to initialize and SSL to be provisioned."
echo ""
echo -e "Access your application at:  ${GREEN}https://${APP_DOMAIN}${NC}"
echo -e "Login Username:              ${GREEN}${SA_USER}${NC}"
echo ""
echo -e "To view logs:                sudo $COMPOSE_COMMAND logs -f"
echo -e "${BLUE}=================================================${NC}"
