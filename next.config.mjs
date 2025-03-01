// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'auto.dev',
      'production-assets2.auto.dev',
      'vehicle-photos-published.vauto.com',
      'cdn.max.auto'
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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