import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.trycloudflare.com", "fernora.nz", "www.fernora.nz"],
};

export default nextConfig;
