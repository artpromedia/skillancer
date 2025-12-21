module.exports = {
  root: true,
  extends: [require.resolve('@skillancer/config/eslint/base')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/no-non-null-assertion': 'off',
    'no-console': 'off',
  },
};
