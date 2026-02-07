/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@skillancer/ui',
    '@skillancer/types',
    '@skillancer/utils',
    '@skillancer/api-client',
  ],

  // ==========================================================================
  // PERFORMANCE OPTIMIZATIONS
  // ==========================================================================

  // Enable React strict mode for better development warnings
  reactStrictMode: true,

  // Ignore type/lint errors during Docker builds
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.skillancer.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },

  // ==========================================================================
  // BUNDLE OPTIMIZATION
  // ==========================================================================

  // Enable SWC minification (faster than Terser)
  swcMinify: true,

  // Compiler options
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // Experimental features for better performance
  experimental: {
    // Optimize package imports (tree-shaking)
    optimizePackageImports: [
      '@skillancer/ui',
      'lucide-react',
      'date-fns',
      'lodash-es',
      '@radix-ui/react-icons',
    ],
  },

  // ==========================================================================
  // CACHING & HEADERS
  // ==========================================================================

  // Custom headers for security and caching
  async headers() {
    return [
      {
        // Static assets (fonts, images in public folder)
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Next.js static files
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Fonts
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // API routes - no cache by default
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        // Security headers for all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
          },
        ],
      },
    ];
  },

  // ==========================================================================
  // WEBPACK CONFIGURATION
  // ==========================================================================

  webpack: (config, { isServer, dev }) => {
    // Optimize chunks in production
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          chunks: 'all',
          cacheGroups: {
            // Vendor chunk for node_modules
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            // Separate chunk for UI components
            ui: {
              test: /[\\/]packages[\\/]ui[\\/]/,
              name: 'ui',
              chunks: 'all',
              priority: 20,
            },
            // Separate chunk for large libraries
            framework: {
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              name: 'framework',
              chunks: 'all',
              priority: 30,
            },
          },
        },
      };
    }

    return config;
  },

  // ==========================================================================
  // OUTPUT CONFIGURATION
  // ==========================================================================

  // Generate source maps in production for error tracking
  productionBrowserSourceMaps: false,

  // Disable x-powered-by header
  poweredByHeader: false,

  // Compress responses
  compress: true,
};

module.exports = nextConfig;
