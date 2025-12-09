import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/context.ts',
    'src/serializers.ts',
    'src/fastify-plugin.ts',
    'src/express-middleware.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['pino', 'pino-pretty', 'fastify', 'fastify-plugin', 'express'],
  treeshake: true,
  minify: false,
});
