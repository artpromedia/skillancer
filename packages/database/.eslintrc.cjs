/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@skillancer/config/eslint/base')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    '**/*.test.ts',
    '**/*.spec.ts',
    'src/__tests__/**',
    'tsup.config.ts',
    'scripts/**/*.ts',
  ],
  rules: {
    // Disable strict type checks - will be re-enabled when Prisma types are fixed
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-console': 'off',
  },
  overrides: [
    {
      // Allow console statements in CLI scripts
      files: ['scripts/**/*.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
