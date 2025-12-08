import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/dates.ts',
    'src/currency.ts',
    'src/strings.ts',
    'src/validation.ts',
    'src/async.ts',
    'src/errors.ts',
    'src/ids.ts',
    'src/objects.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  target: 'es2020',
  outDir: 'dist',
});
