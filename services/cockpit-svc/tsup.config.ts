import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [/^@skillancer\//, '@prisma/client', /^\.prisma/, 'puppeteer', 'zod'],
  tsconfig: './tsconfig.json',
});
