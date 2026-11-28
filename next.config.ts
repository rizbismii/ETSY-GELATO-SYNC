import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // desk.fernora.nz is the public hostname. A bare "fernora.nz" entry does not
  // match it, so next dev rejects the HMR websocket and React never hydrates.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.trycloudflare.com",
    "fernora.nz",
    "*.fernora.nz",
    "www.fernora.nz",
    "desk.fernora.nz",
  ],
  experimental: {
    // Gemini print files are often larger than the 10MB proxy default.
    proxyClientMaxBodySize: "64mb",
  },
};

export default nextConfig;
