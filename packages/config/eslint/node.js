/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['./base.js', 'plugin:n/recommended'],
  plugins: ['n'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Node.js specific
    'n/no-missing-import': 'off', // TypeScript handles this
    'n/no-missing-require': 'off', // TypeScript handles this
    'n/no-unpublished-import': 'off',
    'n/no-unsupported-features/es-syntax': 'off', // TypeScript handles transpilation
    'n/no-process-exit': 'warn',

    // Async/Await best practices
    'no-return-await': 'off',
    '@typescript-eslint/return-await': ['error', 'in-try-catch'],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksVoidReturn: {
          arguments: false,
        },
      },
    ],
    '@typescript-eslint/promise-function-async': 'warn',

    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // Allow console in Node.js services
    'no-console': 'off',
  },
  overrides: [
    {
      files: ['*.test.ts', '*.spec.ts', '**/__tests__/**/*.ts'],
      rules: {
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
      },
    },
  ],
};
