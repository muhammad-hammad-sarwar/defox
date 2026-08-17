import type { NextConfig } from "next";

/**
 * The browser only ever talks to the Next.js origin: /api/* is proxied to the
 * Express backend, which owns every GitHub secret and token.
 */
const apiUrl = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  transpilePackages: ["@defox/shared"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
