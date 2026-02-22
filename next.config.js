const path = require('path');
const { version: nextVersion } = require('next/package.json');

function getNextMajorVersion(version) {
  const major = Number(String(version).split('.')[0]);
  return Number.isFinite(major) ? major : 0;
}

function hasReactCompilerPlugin() {
  try {
    require.resolve('babel-plugin-react-compiler');
    return true;
  } catch {
    return false;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
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

const nextMajor = getNextMajorVersion(nextVersion);
const enableReactCompiler = hasReactCompilerPlugin();
if (enableReactCompiler) {
  if (nextMajor >= 16) {
    nextConfig.reactCompiler = true;
  } else {
    nextConfig.experimental = nextConfig.experimental || {};
    nextConfig.experimental.reactCompiler = true;
  }
}

module.exports = nextConfig;
