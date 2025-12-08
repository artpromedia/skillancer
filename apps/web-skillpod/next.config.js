/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@skillancer/ui', '@skillancer/types', '@skillancer/utils', '@skillancer/api-client'],
};

module.exports = nextConfig;
