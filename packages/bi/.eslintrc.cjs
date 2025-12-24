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
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off', // Allow any for flexible KPI queries
  },
};
