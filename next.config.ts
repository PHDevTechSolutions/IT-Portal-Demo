import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: process.cwd(),
  },
  env: {
    NEXT_PUBLIC_VERCEL_URL: "https://it-portal.devtech-erp-solutions.cloud",
    VERCEL_URL: "https://it-portal.devtech-erp-solutions.cloud",
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
};

export default nextConfig;
