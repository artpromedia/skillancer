/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@skillancer/config/eslint/base')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    '**/__tests__/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    '.eslintrc.cjs',
    'tsup.config.ts',
    'dist/**',
  ],
  rules: {
    // Allow console for debugging in development
    'no-console': 'off',
    // Allow any types for ClickHouse SDK compatibility
    '@typescript-eslint/no-explicit-any': 'warn',
    // Relax for stub methods in mock services
    '@typescript-eslint/require-await': 'warn',
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/unbound-method': 'warn',
  },
};
