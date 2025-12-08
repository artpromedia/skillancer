/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['./eslint-preset.js'],
  env: {
    node: true,
  },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
  },
};
