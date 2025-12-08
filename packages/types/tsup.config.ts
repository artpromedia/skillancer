import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/common/index.ts',
    'src/auth/index.ts',
    'src/market/index.ts',
    'src/skillpod/index.ts',
    'src/cockpit/index.ts',
    'src/billing/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  target: 'es2020',
  outDir: 'dist',
});
