// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'auto.dev' },
      { hostname: 'production-assets2.auto.dev' },
      { hostname: 'vehicle-photos-published.vauto.com' },
      { hostname: 'cdn.max.auto' },
      { hostname: 'pictures.dealer.com' },
      { hostname: 'images.dealersync.com' },
      { hostname: 'content.homenetiol.com' },
      { hostname: 'placehold.co' },
      { hostname: 'via.placeholder.com' },
      { hostname: 'bringatrailer.com' }
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Turbopack configuration
  experimental: {
    turbo: {
      resolveAlias: {
        // Add any module aliases needed for Turbopack
      },
      // Add any Turbopack-specific rules
    },
  },
  webpack: (config) => {
    // SVG configuration
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    // Add fallbacks for Node.js core modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      'fs/promises': false,
      http: false,
      https: false,
      net: false,
      tls: false,
      child_process: false,
      stream: false,
      zlib: false,
      util: false,
      url: false,
      os: false,
      vm: false,
      timers: false,
      'timers/promises': false,
      buffer: false,
      process: false,
      canvas: false,
    };

    return config;
  },
};

export default nextConfig; 