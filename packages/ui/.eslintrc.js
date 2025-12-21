/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@skillancer/config/eslint/react')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['**/*.stories.tsx', '**/*.stories.ts'],
  rules: {
    'jsx-a11y/heading-has-content': 'off',
  },
};
