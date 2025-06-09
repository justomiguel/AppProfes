import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Handle Node.js modules for server-side
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('sqlite3');
    }

    // Add fallbacks for client-side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        events: false,
      };
    }

    return config;
  },
  serverExternalPackages: ['sqlite3', 'sqlite'],
};

export default nextConfig;
