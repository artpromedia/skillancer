module.exports = {
  root: true,
  extends: ['@skillancer/config/eslint-library.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
