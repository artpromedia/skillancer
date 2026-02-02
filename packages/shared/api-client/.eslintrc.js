module.exports = {
  root: true,
  extends: ['@skillancer/config/eslint-library'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
