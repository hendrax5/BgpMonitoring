# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma Client
RUN npx prisma generate
# Build Next.js
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:///app/data/bgp_watcher.db"
ENV NODE_PATH="/app/worker_deps/node_modules"

# Pre-create the data directory and touch the db file so Prisma doesn't crash on initial boot before volume fills
RUN mkdir -p /app/data && touch /app/data/bgp_watcher.db

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN apk add --no-cache openssl

# You only need these for production
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json

# Copy Next.js standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Install tsx and prisma globally
RUN npm install -g tsx prisma@6

# Install production dependencies for the worker securely in a separate directory so it doesn't destruct Next.js node_modules
RUN mkdir -p /app/worker_deps && cd /app/worker_deps && npm init -y && npm install node-cron ssh2 @prisma/client net-snmp

EXPOSE 3000

# We use a custom start script to run both the Next.js server and the Prisma worker
COPY --chown=nextjs:nodejs start.sh ./
RUN chmod +x start.sh

CMD ["./start.sh"]
