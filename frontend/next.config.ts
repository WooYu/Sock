import type { NextConfig } from "next";

export function getNextOutputMode() {
  return process.env.VERCEL ? undefined : 'standalone' as const
}

const nextConfig: NextConfig = { output: getNextOutputMode() };

export default nextConfig;
