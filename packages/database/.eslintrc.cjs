/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@skillancer/config/eslint/base')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
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
