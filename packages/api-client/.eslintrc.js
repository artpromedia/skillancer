/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@skillancer/config/eslint/base')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['scripts/', 'dist/'],
  rules: {
    '@typescript-eslint/no-unsafe-member-access': 'off',
  },
};
