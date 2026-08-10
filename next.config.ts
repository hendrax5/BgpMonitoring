import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Exclude native Node.js modules from Next.js bundle
  // These are only used in server-side code (API routes, worker) — not client-side
  serverExternalPackages: ['ssh2', 'net-snmp', 'ioredis', 'bcryptjs'],
  allowedDevOrigins: [
    '*.preview.emergentagent.com',
    '*.preview.emergentcf.cloud',
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        'b5c92311-711d-4f99-90a6-47941d2440ad.preview.emergentagent.com',
        'b5c92311-711d-4f99-90a6-47941d2440ad.cluster-6.preview.emergentcf.cloud',
        'bgp-management-ui.cluster-6.preview.emergentcf.cloud',
        '*.preview.emergentagent.com',
        '*.cluster-6.preview.emergentcf.cloud',
        '*.preview.emergentcf.cloud',
        'localhost:3000',
      ],
    },
  },
};

export default nextConfig;
