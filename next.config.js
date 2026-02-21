const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', '@xyflow/react', 'react-markdown'],
  },
  serverExternalPackages: ['@google/gemini-cli-core'],
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },
};

module.exports = nextConfig;
