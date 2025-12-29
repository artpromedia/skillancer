/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@skillancer/config/eslint/next')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['*.config.js', '.eslintrc.js'],
  settings: {
    next: {
      rootDir: __dirname,
    },
  },
  rules: {
    // Admin dashboard forms use internal components - disable strict label association
    'jsx-a11y/label-has-associated-control': 'off',
    // Allow console for admin debugging/logging
    'no-console': 'warn',
  },
};
