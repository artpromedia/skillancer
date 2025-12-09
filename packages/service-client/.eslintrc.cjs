/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@skillancer/config/eslint/node')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**'],
  rules: {
    // Allow QueueName | string patterns for extensibility with IDE autocomplete
    '@typescript-eslint/no-redundant-type-constituents': 'off',
    // Allow sync functions returning Promise for simple implementations
    '@typescript-eslint/promise-function-async': 'off',
  },
};
