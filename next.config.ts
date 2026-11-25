import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Screens already visited or prefetched open from memory for 5 minutes
    // (data lives on the device anyway; saving settings refreshes them).
    staleTimes: { dynamic: 300, static: 300 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
