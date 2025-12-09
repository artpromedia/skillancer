import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/fastify-plugin.ts',
    'src/express-middleware.ts',
    'src/business-metrics.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  splitting: false,
  external: ['fastify', 'express'],
});
