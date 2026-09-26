import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.trycloudflare.com", "fernora.nz", "www.fernora.nz"],
  experimental: {
    // Gemini print files are often larger than the 10MB proxy default.
    proxyClientMaxBodySize: "64mb",
  },
};

export default nextConfig;
