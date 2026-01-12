import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'test/**/*.test.ts', 'test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts', 'vitest.config.ts'],
    },
    setupFiles: ['./test/setup.ts'],
    testTimeout: 10000,
    deps: {
      interopDefault: true,
    },
  },
  resolve: {
    alias: {
      '@skillancer/database': new URL('./test/__mocks__/database.ts', import.meta.url).pathname,
      '@skillancer/logger': new URL('./test/__mocks__/logger.ts', import.meta.url).pathname,
      '@skillancer/config': new URL('./test/__mocks__/config.ts', import.meta.url).pathname,
      '@skillancer/cache': new URL('./test/__mocks__/cache.ts', import.meta.url).pathname,
    },
  },
});
