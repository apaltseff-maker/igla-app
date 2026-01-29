import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Меньше JS на старых устройствах: дерево-шейк тяжёлых пакетов
  experimental: {
    optimizePackageImports: ["@supabase/supabase-js"],
  },
};

export default nextConfig;
