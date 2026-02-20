/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', '@xyflow/react', 'react-markdown'],
  },
  serverExternalPackages: ['@google/gemini-cli-core'],
};

module.exports = nextConfig;
