import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    '@prisma/client',
    '.prisma/client',
    '.prisma/client/default',
    '@fastify/cors',
    '@fastify/helmet',
    '@fastify/jwt',
    '@fastify/rate-limit',
    '@fastify/sensible',
    'dotenv',
    'fastify',
    'fastify-plugin',
    'pino',
    'pino-pretty',
    'zod',
    'zod-to-json-schema',
  ],
  tsconfig: './tsconfig.json',
});
