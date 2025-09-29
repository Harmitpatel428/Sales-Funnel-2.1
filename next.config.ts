import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Export configuration for Electron
  output: 'export',
  trailingSlash: true,
  
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react', 'recharts'],
    webpackBuildWorker: true,
  },
  
  // Image optimization
  images: {
    unoptimized: true,
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  
  // Compression and optimization
  compress: true,
  poweredByHeader: false,
  
  // Bundle optimization
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      // Optimize for production builds
      if (!dev) {
        config.optimization.splitChunks = {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              enforce: true,
            },
          },
        };
      }
      
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
  
  // Bundle analyzer (uncomment to analyze bundle size)
  // webpack: (config, { isServer }) => {
  //   if (!isServer) {
  //     config.resolve.fallback = {
  //       ...config.resolve.fallback,
  //       fs: false,
  //     };
  //   }
  //   return config;
  // },
  
  // Headers for better caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
