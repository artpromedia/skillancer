module.exports = {
  root: true,
  extends: ['@skillancer/config/eslint/library'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // Allow any for JWT payload types
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
