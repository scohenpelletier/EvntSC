import type { NextConfig } from "next";

// Cache Components is intentionally disabled: every account page reads the
// session at request time and we never want plan data in a shared cache.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
