module.exports = {
  root: true,
  extends: ['@skillancer/config/eslint'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
