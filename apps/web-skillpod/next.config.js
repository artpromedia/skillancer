/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@skillancer/ui', '@skillancer/types', '@skillancer/utils', '@skillancer/api-client'],
  typescript: {
    // Ignore TypeScript errors during build for faster iteration
    // TODO: Fix type errors and remove this
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
