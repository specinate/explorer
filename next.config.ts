import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  turbopack: {
    resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json"]
  },
};

export default nextConfig;
