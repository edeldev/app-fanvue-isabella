import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["src/generated/prisma/libquery_engine-*.node"],
  },
};

export default nextConfig;
