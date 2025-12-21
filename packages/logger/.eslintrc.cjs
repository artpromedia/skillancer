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
    '.eslintrc.js',
    'tsup.config.ts',
  ],
  rules: {
    'no-console': 'off', // Allow console for logging utilities
  },
};
