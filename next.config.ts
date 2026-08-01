import type { NextConfig } from "next";

const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

const nextConfig: NextConfig = {
  turbopack: isRailway
    ? { resolveAlias: { "cloudflare:workers": "./railway/cloudflare-workers.ts" } }
    : undefined,
};

export default nextConfig;
