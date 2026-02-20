import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', '@xyflow/react', 'react-markdown'],
  },
  serverExternalPackages: ['@google/gemini-cli-core'],
};

export default nextConfig;
