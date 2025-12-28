/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@skillancer/config/eslint/base')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['**/*.test.ts', '**/*.spec.ts', 'vitest.config.ts', '**/k6/**/*.js', 'dist/**'],
  rules: {
    // Allow any types in test utilities
    '@typescript-eslint/no-explicit-any': 'off',
    // Allow require for jest.fn()
    '@typescript-eslint/no-require-imports': 'off',
    // Downgrade type safety errors to warnings for testing utilities
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/require-await': 'warn',
    '@typescript-eslint/no-floating-promises': 'warn',
    // Allow namespaces in test setup
    '@typescript-eslint/no-namespace': 'warn',
  },
};
