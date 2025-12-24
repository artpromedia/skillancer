/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@skillancer/config/eslint/base')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['**/*.test.ts', '**/*.spec.ts', 'vitest.config.ts', '**/k6/**/*.js'],
  rules: {
    // Allow any types in test utilities
    '@typescript-eslint/no-explicit-any': 'off',
    // Allow require for jest.fn()
    '@typescript-eslint/no-require-imports': 'off',
  },
};
