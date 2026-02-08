import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  splitting: false,
  sourcemap: true,
  clean: true,
  // Keep all workspace packages and node_modules external — they resolve from node_modules at runtime
  external: [
    '@prisma/client',
    '.prisma/client',
    '.prisma/client/default',
    '@skillancer/cache',
    '@skillancer/database',
    '@skillancer/logger',
    '@skillancer/metrics',
    '@skillancer/types',
    '@skillancer/utils',
    '@skillancer/audit-client',
    'ioredis',
    'fastify',
    'fastify-plugin',
    '@fastify/cors',
    '@fastify/helmet',
    '@fastify/jwt',
    '@fastify/sensible',
    '@fastify/websocket',
    'bullmq',
    'dotenv',
    'pino-pretty',
    'ws',
    'zod',
  ],
  // tsup/esbuild resolves path aliases from tsconfig automatically
  tsconfig: './tsconfig.json',
});
