import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/.prisma/client/**/*",
      "node_modules/@prisma/client/**/*",
    ],
  },
};

export default nextConfig;
