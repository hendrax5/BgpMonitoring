#!/bin/bash
set -e

# ==============================================================================
# BgpMonitoring Native LXC Installer (Proxmox / Baremetal)
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
echo -e "${GREEN}   BgpMonitoring - Native LXC Installer          ${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# 1. Inputs
read -p "Enter Domain Name (e.g., nms.yourdomain.com / IP Address): " APP_DOMAIN
while [[ -z "$APP_DOMAIN" ]]; do
    read -p "Enter Domain Name: " APP_DOMAIN
done

read -p "Enter Administrator Email (for Let's Encrypt SSL): " SSL_EMAIL
read -p "Enter Superadmin Username [default: superadmin]: " SA_USER
SA_USER=${SA_USER:-superadmin}
read -s -p "Enter Superadmin Password [minimum 8 characters]: " SA_PASS
echo ""

# Generate secure random strings for internal use
JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

# 2. Update & Install Prerequisites
echo -e "${YELLOW}>> Updating system and installing base dependencies...${NC}"
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git sudo lsb-release ca-certificates apt-transport-https software-properties-common gnupg2

# 3. Install Node.js 20
echo -e "${YELLOW}>> Installing Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2

# 4. Install PostgreSQL 16 & Redis
echo -e "${YELLOW}>> Installing PostgreSQL & Redis...${NC}"
install -d /usr/share/postgresql-common/pgdg
curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
apt-get update -y
apt-get install -y postgresql-16 redis-server

systemctl enable postgresql redis-server
systemctl start postgresql redis-server

# Configure PostgreSQL Database and User
echo -e "${YELLOW}>> Configuring PostgreSQL Database...${NC}"
sudo -u postgres psql -c "CREATE DATABASE bgpmon;" || true
sudo -u postgres psql -c "CREATE USER bgpmon WITH ENCRYPTED PASSWORD '${POSTGRES_PASSWORD}';" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE bgpmon TO bgpmon;" || true
sudo -u postgres psql -c "ALTER DATABASE bgpmon OWNER TO bgpmon;" || true

# 5. Install Caddy
echo -e "${YELLOW}>> Installing Caddy Web Server...${NC}"
apt-get install -y debian-keyring debian-archive-keyring
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes || true
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy

# 6. Setup Project
echo -e "${YELLOW}>> Setting up BgpMonitoring project...${NC}"
PROJECT_DIR="/opt/bgp-monitoring"

if [ ! -d "$PROJECT_DIR" ]; then
    if [ -f "package.json" ]; then
        echo -e "${YELLOW}>> Found project files. Moving to $PROJECT_DIR...${NC}"
        mkdir -p $PROJECT_DIR
        cp -r . $PROJECT_DIR
    else
        echo -e "${RED}Error: Cannot find package.json. Please run this script from inside the project directory!${NC}"
        exit 1
    fi
fi

cd $PROJECT_DIR

# Create .env
echo -e "${YELLOW}>> Creating .env configuration...${NC}"
cat > .env <<EOF
NODE_ENV=production

# Database Configuration
POSTGRES_USER=bgpmon
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=bgpmon
DATABASE_URL=postgresql://bgpmon:${POSTGRES_PASSWORD}@localhost:5432/bgpmon?schema=public

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Internal Networking Secrets
JWT_SECRET=${JWT_SECRET}
SUPERADMIN_USERNAME=${SA_USER}
SUPERADMIN_PASSWORD=${SA_PASS}
EOF

# Build Application
echo -e "${YELLOW}>> Installing NPM packages and compiling build... (this may take a few minutes)${NC}"
npm install
npx prisma generate
npx prisma db push --accept-data-loss
npm run build

# 7. Setup PM2 Process Manager
echo -e "${YELLOW}>> Configuring PM2 Process Manager...${NC}"
cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [
    {
      name: "bgpmon-web",
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "bgpmon-worker",
      script: "npm",
      args: "run worker",
      env: {
        NODE_ENV: "production",
      }
    }
  ]
};
EOF

pm2 start ecosystem.config.js
pm2 save
pm2 startup | grep "pm2" | tail -n 1 | sudo bash

# 8. Configure Caddy Reverse Proxy
echo -e "${YELLOW}>> Configuring Caddy Web Server...${NC}"
cat > /etc/caddy/Caddyfile <<EOF
{
    email ${SSL_EMAIL}
}

${APP_DOMAIN} {
    reverse_proxy localhost:3000
    
    # Compress responses
    encode zstd gzip
    
    # Security Headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options nosniff
        X-Frame-Options SAMEORIGIN
        Referrer-Policy strict-origin-when-cross-origin
    }
}
EOF

systemctl restart caddy
systemctl enable caddy

echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN} 🎉 NATIVE LXC INSTALLATION COMPLETE!            ${NC}"
echo -e "${GREEN}=================================================${NC}"
echo -e "Access your application at:  ${GREEN}https://${APP_DOMAIN}${NC}"
echo -e "Login Username:              ${GREEN}${SA_USER}${NC}"
echo -e "Check processes status:      ${YELLOW}pm2 status${NC}"
echo -e "${BLUE}=================================================${NC}"
