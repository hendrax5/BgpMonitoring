import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Exclude native Node.js modules from Next.js bundle
  // These are only used in server-side code (API routes, worker) — not client-side
  serverExternalPackages: ['ssh2', 'ssh2-promise', 'net-snmp', 'ioredis', 'bcryptjs'],
  experimental: {
    serverActions: {
      allowedOrigins: ['*']
    }
  }
};

export default nextConfig;
