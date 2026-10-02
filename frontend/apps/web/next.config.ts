import path from "node:path";
import type { NextConfig } from "next";

const root = path.resolve(__dirname, "../..");

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@kitty/ui", "@kitty/sdk", "@kitty/chain", "@kitty/zk", "@kitty/diary"],
  turbopack: { root },
  outputFileTracingRoot: root,
  images: { unoptimized: true },
  poweredByHeader: false,
  devIndicators: false,
};

export default config;
