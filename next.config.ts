import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config: any, { isServer, webpack }: { isServer: boolean; webpack: any }) => {
    // Add support for .wasm files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add WASM support
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Handle Node.js modules for server-side
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('sqlite3');
      // Don't bundle @xenova/transformers on server side
      config.externals.push('@xenova/transformers');
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
        buffer: require.resolve('buffer/'),
        events: false,
        url: false,
        zlib: false,
        https: false,
        http: false,
        querystring: false,
        process: require.resolve('process/browser'),
        os: false,
        assert: false,
        constants: false,
      };

      // Provide global polyfills using the webpack instance passed in
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      );
    }

    return config;
  },
  
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
        ],
      },
    ];
  },
  
  serverExternalPackages: ['sqlite3', 'sqlite', '@xenova/transformers'],

  // Environment variables for Transformers.js
  env: {
    TRANSFORMERS_CACHE: '.cache',
    NEXT_PUBLIC_TRANSFORMERS_CACHE: '.cache',
    NEXT_PUBLIC_USE_FS: 'false',
    NEXT_PUBLIC_USE_REMOTE_MODELS: 'true',
  },
};

export default nextConfig;
