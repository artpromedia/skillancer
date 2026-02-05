module.exports = {
  root: true,
  env: {
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  rules: {
    // k6 tests use specific imports and patterns
    'no-undef': 'off',
    'no-unused-vars': 'off',
  },
};
