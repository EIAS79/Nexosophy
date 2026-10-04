import { resolve } from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  outputFileTracingRoot: resolve(process.cwd(), "../.."),
  typedRoutes: true,
  transpilePackages: ["@nexosophy/ui"],
};

export default nextConfig;
